import { Inject, Injectable } from '@nestjs/common';
import { err, ok, Result } from 'neverthrow';

import { PaymentRepository } from '../domain/repositories/payment.repository';
import { Payment } from '../domain/payment';
import { PaymentsKafkaProducer } from '../infrastructure/presentation/kafka.producer';
import { BaseException } from '../../../core/exceptions/base.exception';

export type CreatePaymentResult = Promise<
  Result<Payment, BaseException>
>;
export type UpdatePaymentStatusResult = Promise<Result<void, BaseException>>;

@Injectable()
export class PaymentsApplication {
  constructor(
    @Inject(PaymentRepository)
    private readonly repository: PaymentRepository,
  ) {}

  async createPayment(input: {
    fromUserId: string;
    toUserId: string;
    amount: number;
    currency: string;
    description?: string;
  }): CreatePaymentResult {
    const payment = new Payment({
      fromUserId: input.fromUserId,
      toUserId: input.toUserId,
      amount: input.amount,
      currency: input.currency,
      description: input.description,
    });

    const result = await this.repository.createAndProcess(payment);

    if (result.isErr()) {
      return err(result.error);
    }

    const created = result.value;

    return ok(created);
  }

  async updatePaymentStatus(
    paymentId: string,
    status: 'COMPLETED' | 'FAILED',
  ): UpdatePaymentStatusResult {
    return this.repository.updateStatus(paymentId, status);
  }
}