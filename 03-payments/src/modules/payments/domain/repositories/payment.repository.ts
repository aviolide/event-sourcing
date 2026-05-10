import { Payment } from '../payment';
import {
  PaymentResult,
  PaymentUpdateResult,
} from '../../infrastructure/payment.infrastructure';

export abstract class PaymentRepository {
  abstract createAndProcess(payment: Payment): PaymentResult;
  abstract updateStatus(
    paymentId: string,
    status: 'COMPLETED' | 'FAILED',
  ): PaymentUpdateResult;
  abstract findById(paymentId: string): Promise<Payment | null>;
}