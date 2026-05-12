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
  WalletServiceException,
} from '../../../core/exceptions/payment.exception';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { refill } from './payment-queries';

export type PaymentResult = Promise<Result<Payment, BaseException>>;
export type PaymentUpdateResult = Promise<Result<void, BaseException>>;

@Injectable()
export class PaymentInfrastructure implements PaymentRepository {
  constructor(
    @InjectRepository(PaymentEntity)
    private readonly repository: Repository<PaymentEntity>,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
  ) {}

  async createAndProcess(payment: Payment): PaymentResult {
    const walletServiceUrl = this.configService.get<string>('WALLET_SERVICE_URL');

    const props = payment.properties();

    // -------- 1. Llamar a Wallet por HTTP (transfer) ----------
    try {
      await firstValueFrom(
        this.httpService.post(`${walletServiceUrl}/wallets/transfer`, {
          fromUserId: props.fromUserId,
          toUserId: props.toUserId,
          amount: props.amount,
          currency: props.currency,
        }),
      );
    } catch (error: any) {
      console.log("🚀 ~ PaymentInfrastructure ~ error:", error)
      const msg =
        error?.response?.data?.message ||
        error?.message ||
        'Error calling Wallet Service';

        const failedEntity = this.repository.create({
          ...props,
          amount: props.amount.toString(),
          status: 'FAILED',
        });
        await this.repository.save(failedEntity);


      return err(new WalletServiceException(msg, error?.stack));
    }

    // -------- 2. Guardar Payment COMPLETED en BD ----------
    try {
      const entity = this.repository.create({
        fromUserId: props.fromUserId,
        toUserId: props.toUserId,
        amount: props.amount.toString(),
        currency: props.currency,
        description: props.description,
        status: 'COMPLETED',
      });

      const saved = await this.repository.save(entity);

      const paymentCompleted = new Payment({
        ...props,
        id: saved.id,
        status: saved.status,
        createdAt: saved.createdAt,
        updatedAt: saved.updatedAt,
      });

      return ok(paymentCompleted);
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
  ): Promise<RefillResult> {
    try {
      const result = await refill(this.dataSource.createQueryRunner(), toUserId, amount, currency);

      const payment = new Payment({
        id: result.to.id,
        fromUserId: result.to.fromUserId,
        toUserId: result.to.toUserId,
        amount: Number(result.to.amount),
        currency: result.to.currency,
        description: result.to.description || '',
        status: result.to.status,
        createdAt: new Date(result.to.createdAt),
        updatedAt: new Date(result.to.updatedAt),
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