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
    const sagaId = payload.requestId || randomUUID();

    await this.sagaRepo.save({
      sagaId,
      type: 'Transfer',
      status: 'PENDING',
      step: 'TRANSFER_INITIATED',
      payload,
    });

    this.logger.log(`Saga started: sagaId=${sagaId} step=TRANSFER_INITIATED`);

    // Publish command to wallet service
    await this.kafkaProducer.publish({
      topic: Topics.CMD_WALLET_TRANSFER,
      payload: {
        requestId: sagaId,
        transferId: randomUUID(),
        fromUserId: payload.fromUserId,
        toUserId: payload.toUserId,
        amount: payload.amount,
        currency: payload.currency,
        description: payload.description,
      },
      aggregateId: sagaId,
      aggregateType: 'PaymentTransfer',
      aggregateVersion: 1,
      correlationId: payload.correlationId || sagaId,
      producer: 'saga-orchestrator',
    });

    await this.sagaRepo.update(
      { sagaId },
      { step: 'AWAITING_DEBIT_RESULT' },
    );
  }

  async onWalletDebited(
    sagaId: string,
    payload: Record<string, unknown>,
    correlationId?: string,
  ) {
    this.logger.log(`Saga debit succeeded: sagaId=${sagaId}`);

    await this.sagaRepo.update(
      { sagaId },
      { step: 'DEBIT_SUCCESS', status: 'COMPLETED' },
    );

    await this.kafkaProducer.publish({
      topic: Topics.EVT_PAYMENT_COMPLETED,
      payload: {
        requestId: sagaId,
        ...payload,
      },
      aggregateId: sagaId,
      aggregateType: 'PaymentTransfer',
      aggregateVersion: 2,
      correlationId: correlationId || sagaId,
      producer: 'saga-orchestrator',
    });
  }

  async onWalletDebitFailed(
    sagaId: string,
    reason: string,
    correlationId?: string,
  ) {
    this.logger.error(`Saga debit failed: sagaId=${sagaId} reason=${reason}`);

    await this.sagaRepo.update(
      { sagaId },
      { step: 'DEBIT_FAILED', status: 'FAILED', lastError: reason },
    );

    await this.kafkaProducer.publish({
      topic: Topics.EVT_PAYMENT_FAILED,
      payload: {
        requestId: sagaId,
        reason,
      },
      aggregateId: sagaId,
      aggregateType: 'PaymentTransfer',
      aggregateVersion: 2,
      correlationId: correlationId || sagaId,
      producer: 'saga-orchestrator',
    });
  }

  async findBySagaId(sagaId: string): Promise<SagaInstance | null> {
    return this.sagaRepo.findOne({ where: { sagaId } });
  }
}
