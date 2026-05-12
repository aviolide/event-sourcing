import { Payment } from '../payment';
import {
  PaymentResult,
  PaymentUpdateResult,
} from '../../infrastructure/payment.infrastructure';
import { Result } from 'neverthrow';
import { BaseException } from 'src/core/exceptions/base.exception';
export type RefillResult = Result<{ payment: Payment }, BaseException>;

export abstract class PaymentRepository {
  abstract createAndProcess(payment: Payment): PaymentResult;
  abstract refill(
    toUserId: string,
    amount: number,
    currency: string,
  ): Promise<RefillResult>;
  abstract updateStatus(
    paymentId: string,
    status: 'COMPLETED' | 'FAILED',
  ): PaymentUpdateResult;
  abstract findById(paymentId: string): Promise<Payment | null>;
}