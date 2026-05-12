import { Inject, Injectable } from '@nestjs/common';
import { err, ok, Result } from 'neverthrow';

import { PaymentRepository, RefillResult } from '../domain/repositories/payment.repository';
import { Payment } from '../domain/payment';
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

    return this.repository.createPayment(payment);
  }

  async createRefill(
    input: {
      userId: string,
      amount: number,
      currency: string,
      description?: string,
    }
  ): Promise<RefillResult> {
    return this.repository.createRefill(input.userId, input.amount, input.currency, input.description);
  }

  async updatePaymentStatus(
    paymentId: string,
    status: 'COMPLETED' | 'FAILED',
  ): UpdatePaymentStatusResult {
    return this.repository.updateStatus(paymentId, status);
  }
}
