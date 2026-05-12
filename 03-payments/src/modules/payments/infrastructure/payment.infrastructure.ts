import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { err, ok, Result } from 'neverthrow';
import { DataSource, Repository } from 'typeorm';

import { PaymentRepository, RefillResult } from '../domain/repositories/payment.repository';
import { Payment } from '../domain/payment';
import { PaymentEntity } from './entities/payment.entity';
import { BaseException } from '../../../core/exceptions/base.exception';
import {
  PaymentCreateDatabaseException,
  PaymentNotFoundException,
  PaymentUpdateDatabaseException,
} from '../../../core/exceptions/payment.exception';
import { KafkaProducerService, Topics } from '@yupi/messaging';
import { randomUUID } from 'node:crypto';

export type PaymentResult = Promise<Result<Payment, BaseException>>;
export type PaymentUpdateResult = Promise<Result<void, BaseException>>;

@Injectable()
export class PaymentInfrastructure implements PaymentRepository {
  constructor(
    @InjectRepository(PaymentEntity)
    private readonly repository: Repository<PaymentEntity>,
    private readonly dataSource: DataSource,
    private readonly kafkaProducer: KafkaProducerService,
  ) {}

  async createAndProcess(payment: Payment): PaymentResult {
    const props = payment.properties();

    try {
      const entity = this.repository.create({
        fromUserId: props.fromUserId,
        toUserId: props.toUserId,
        amount: props.amount.toString(),
        currency: props.currency,
        description: props.description,
        status: 'PENDING',
      });

      const saved = await this.repository.save(entity);

      const paymentPending = new Payment({
        ...props,
        id: saved.id,
        status: saved.status,
        createdAt: saved.createdAt,
        updatedAt: saved.updatedAt,
      });

      // Publish command to wallet service instead of calling HTTP
      await this.kafkaProducer.publish({
        topic: Topics.CMD_WALLET_TRANSFER,
        payload: {
          requestId: saved.id,
          transferId: randomUUID(),
          fromUserId: props.fromUserId,
          toUserId: props.toUserId,
          amount: props.amount,
          currency: props.currency,
          description: props.description,
        },
        aggregateId: saved.id,
        aggregateType: 'PaymentTransfer',
        aggregateVersion: 1,
        producer: 'payments-service',
      });

      return ok(paymentPending);
    } catch (error: any) {
      return err(
        new PaymentCreateDatabaseException(error.message, error.stack),
      );
    }
  }

  async refill(
    toUserId: string,
    amount: number,
    currency: string,
    description?: string,
  ): Promise<RefillResult> {
    try {
      const entity = this.repository.create({
        fromUserId: toUserId,
        toUserId,
        amount: amount.toString(),
        currency,
        description: description || 'Refill',
        status: 'PENDING',
      });

      const saved = await this.repository.save(entity);

      await this.kafkaProducer.publish({
        topic: Topics.CMD_WALLET_REFILL,
        payload: {
          requestId: saved.id,
          userId: toUserId,
          amount,
          currency,
          description: description || 'Refill',
        },
        aggregateId: saved.id,
        aggregateType: 'WalletRefill',
        aggregateVersion: 1,
        producer: 'payments-service',
      });

      const payment = new Payment({
        id: saved.id,
        fromUserId: toUserId,
        toUserId,
        amount,
        currency,
        description: description || 'Refill',
        status: saved.status,
        createdAt: saved.createdAt,
        updatedAt: saved.updatedAt,
      });

      return ok({ payment });
    } catch (error: any) {
      return err(
        new PaymentCreateDatabaseException(
          error?.message || 'Error refilling wallet',
          error?.stack,
        ),
      );
    }
  }

  async updateStatus(
    paymentId: string,
    status: 'COMPLETED' | 'FAILED',
  ): PaymentUpdateResult {
    try {
      const payment = await this.repository.findOne({ where: { id: paymentId } });

      if (!payment) {
        return err(new PaymentNotFoundException());
      }

      payment.status = status;
      payment.updatedAt = new Date();

      await this.repository.save(payment);

      return ok(undefined);
    } catch (error: any) {
      return err(
        new PaymentUpdateDatabaseException(error.message, error.stack),
      );
    }
  }

  async findById(paymentId: string): Promise<Payment | null> {
    const entity = await this.repository.findOne({ where: { id: paymentId } });
    if (!entity) return null;

    return new Payment({
      id: entity.id,
      fromUserId: entity.fromUserId,
      toUserId: entity.toUserId,
      amount: Number(entity.amount),
      currency: entity.currency,
      description: entity.description,
      status: entity.status,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    });
  }
}
