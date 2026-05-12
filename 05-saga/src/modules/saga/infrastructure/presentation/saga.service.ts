import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'node:crypto';

import { SagaInstance } from './entities/saga-instance.entity';
import { KafkaProducerService, Topics } from '@yupi/messaging';

@Injectable()
export class SagaService {
  private readonly logger = new Logger(SagaService.name);

  constructor(
    @InjectRepository(SagaInstance)
    private readonly sagaRepo: Repository<SagaInstance>,
    private readonly kafkaProducer: KafkaProducerService,
  ) {}

  async startTransferSaga(payload: {
    requestId: string;
    fromUserId: string;
    toUserId: string;
    amount: number;
    currency: string;
    description?: string;
    correlationId?: string;
  }) {
    const transferId = randomUUID();

    await this.sagaRepo.save({
      requestId: payload.requestId,
      type: 'Transfer',
      status: 'PENDING',
      step: 'INITIATED',
      payload: {
        ...payload,
        transferId,
      },
    });

    this.logger.log(
      `Saga started: requestId=${payload.requestId} transferId=${transferId}`,
    );

    // Step 1: Reserve funds from sender
    await this.kafkaProducer.publish({
      topic: Topics.CMD_WALLET_RESERVE,
      payload: {
        requestId: payload.requestId,
        transferId,
        userId: payload.fromUserId,
        amount: payload.amount,
        currency: payload.currency,
      },
      aggregateId: payload.requestId,
      aggregateType: 'PaymentTransfer',
      aggregateVersion: 1,
      correlationId: payload.correlationId || payload.requestId,
      producer: 'saga-orchestrator',
    });

    await this.sagaRepo.update(
      { requestId: payload.requestId },
      { step: 'RESERVING' },
    );
  }

  async onWalletReserved(
    requestId: string,
    correlationId?: string,
  ) {
    const saga = await this.sagaRepo.findOne({ where: { requestId } });
    if (!saga) {
      this.logger.warn(`Saga not found for requestId=${requestId}`);
      return;
    }

    if (saga.step !== 'RESERVING') {
      this.logger.warn(
        `Unexpected step ${saga.step} for requestId=${requestId}, expected RESERVING`,
      );
      return;
    }

    this.logger.log(`Saga reserve succeeded: requestId=${requestId}`);

    await this.sagaRepo.update(
      { requestId },
      { step: 'RESERVED' },
    );

    const sagaPayload = saga.payload as any;

    // Step 2: Credit funds to receiver
    await this.kafkaProducer.publish({
      topic: Topics.CMD_WALLET_CREDIT,
      payload: {
        requestId,
        transferId: sagaPayload.transferId,
        userId: sagaPayload.toUserId,
        amount: sagaPayload.amount,
        currency: sagaPayload.currency,
      },
      aggregateId: requestId,
      aggregateType: 'PaymentTransfer',
      aggregateVersion: 2,
      correlationId: correlationId || requestId,
      producer: 'saga-orchestrator',
    });

    await this.sagaRepo.update(
      { requestId },
      { step: 'CREDITING' },
    );
  }

  async onWalletReserveFailed(
    requestId: string,
    reason: string,
    correlationId?: string,
  ) {
    const saga = await this.sagaRepo.findOne({ where: { requestId } });
    if (!saga) {
      this.logger.warn(`Saga not found for requestId=${requestId}`);
      return;
    }

    this.logger.error(
      `Saga reserve failed: requestId=${requestId} reason=${reason}`,
    );

    await this.sagaRepo.update(
      { requestId },
      { step: 'RESERVE_FAILED', status: 'FAILED', lastError: reason },
    );

    await this.kafkaProducer.publish({
      topic: Topics.EVT_PAYMENT_FAILED,
      payload: {
        requestId,
        reason,
      },
      aggregateId: requestId,
      aggregateType: 'PaymentTransfer',
      aggregateVersion: 1,
      correlationId: correlationId || requestId,
      producer: 'saga-orchestrator',
    });
  }

  async onWalletCredited(
    requestId: string,
    correlationId?: string,
  ) {
    const saga = await this.sagaRepo.findOne({ where: { requestId } });
    if (!saga) {
      this.logger.warn(`Saga not found for requestId=${requestId}`);
      return;
    }

    if (saga.step !== 'CREDITING') {
      this.logger.warn(
        `Unexpected step ${saga.step} for requestId=${requestId}, expected CREDITING`,
      );
      return;
    }

    this.logger.log(`Saga credit succeeded: requestId=${requestId}`);

    await this.sagaRepo.update(
      { requestId },
      { step: 'CREDITED' },
    );

    const sagaPayload = saga.payload as any;

    // Step 3: Commit reserved funds from sender (finalize)
    await this.kafkaProducer.publish({
      topic: Topics.CMD_WALLET_COMMIT,
      payload: {
        requestId,
        transferId: sagaPayload.transferId,
        userId: sagaPayload.fromUserId,
        amount: sagaPayload.amount,
        currency: sagaPayload.currency,
      },
      aggregateId: requestId,
      aggregateType: 'PaymentTransfer',
      aggregateVersion: 3,
      correlationId: correlationId || requestId,
      producer: 'saga-orchestrator',
    });

    await this.sagaRepo.update(
      { requestId },
      { step: 'COMMITTING' },
    );
  }

  async onWalletCreditFailed(
    requestId: string,
    reason: string,
    correlationId?: string,
  ) {
    const saga = await this.sagaRepo.findOne({ where: { requestId } });
    if (!saga) {
      this.logger.warn(`Saga not found for requestId=${requestId}`);
      return;
    }

    this.logger.error(
      `Saga credit failed: requestId=${requestId} reason=${reason}`,
    );

    const sagaPayload = saga.payload as any;

    // Compensation: release reserved funds from sender
    await this.kafkaProducer.publish({
      topic: Topics.CMD_WALLET_RELEASE,
      payload: {
        requestId,
        transferId: sagaPayload.transferId,
        userId: sagaPayload.fromUserId,
        amount: sagaPayload.amount,
        currency: sagaPayload.currency,
      },
      aggregateId: requestId,
      aggregateType: 'PaymentTransfer',
      aggregateVersion: 3,
      correlationId: correlationId || requestId,
      producer: 'saga-orchestrator',
    });

    await this.sagaRepo.update(
      { requestId },
      { step: 'RELEASING', status: 'COMPENSATING', lastError: reason },
    );
  }

  async onWalletCommitted(
    requestId: string,
    correlationId?: string,
  ) {
    const saga = await this.sagaRepo.findOne({ where: { requestId } });
    if (!saga) {
      this.logger.warn(`Saga not found for requestId=${requestId}`);
      return;
    }

    if (saga.step !== 'COMMITTING') {
      this.logger.warn(
        `Unexpected step ${saga.step} for requestId=${requestId}, expected COMMITTING`,
      );
      return;
    }

    this.logger.log(`Saga completed: requestId=${requestId}`);

    await this.sagaRepo.update(
      { requestId },
      { step: 'COMPLETED', status: 'COMPLETED' },
    );

    await this.kafkaProducer.publish({
      topic: Topics.EVT_PAYMENT_COMPLETED,
      payload: {
        requestId,
      },
      aggregateId: requestId,
      aggregateType: 'PaymentTransfer',
      aggregateVersion: 4,
      correlationId: correlationId || requestId,
      producer: 'saga-orchestrator',
    });
  }

  async onWalletReleased(
    requestId: string,
    correlationId?: string,
  ) {
    const saga = await this.sagaRepo.findOne({ where: { requestId } });
    if (!saga) {
      this.logger.warn(`Saga not found for requestId=${requestId}`);
      return;
    }

    if (saga.status === 'COMPENSATING') {
      // Compensation completed
      this.logger.log(`Saga compensation completed: requestId=${requestId}`);
      await this.sagaRepo.update(
        { requestId },
        { step: 'FAILED', status: 'FAILED' },
      );

      await this.kafkaProducer.publish({
        topic: Topics.EVT_PAYMENT_FAILED,
        payload: {
          requestId,
          reason: saga.lastError || 'Credit failed, funds released',
        },
        aggregateId: requestId,
        aggregateType: 'PaymentTransfer',
        aggregateVersion: 4,
        correlationId: correlationId || requestId,
        producer: 'saga-orchestrator',
      });
    }
  }

  async findByRequestId(requestId: string): Promise<SagaInstance | null> {
    return this.sagaRepo.findOne({ where: { requestId } });
  }
}
