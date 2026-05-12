import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WalletBalanceView } from './entities/wallet-balance.view';
import { PaymentStatusView } from './entities/payment-status.view';

@Injectable()
export class ProjectionsService {
  private readonly logger = new Logger(ProjectionsService.name);

  constructor(
    @InjectRepository(WalletBalanceView)
    private readonly walletBalanceRepo: Repository<WalletBalanceView>,
    @InjectRepository(PaymentStatusView)
    private readonly paymentStatusRepo: Repository<PaymentStatusView>,
  ) {}

  async onWalletCreated(payload: {
    walletId: string;
    userId: string;
    currency: string;
    initialBalance: number;
  }) {
    const existing = await this.walletBalanceRepo.findOne({
      where: { userId: payload.userId },
    });

    if (!existing) {
      await this.walletBalanceRepo.save({
        walletId: payload.walletId,
        userId: payload.userId,
        currency: payload.currency,
        balance: String(payload.initialBalance),
        version: 1,
      });
      this.logger.log(`Wallet projection created: userId=${payload.userId}`);
    }
  }

  async onWalletCredited(payload: {
    walletId: string;
    userId: string;
    amount: number;
    currency: string;
    newBalance: number;
  }) {
    const existing = await this.walletBalanceRepo.findOne({
      where: { userId: payload.userId },
    });

    if (existing) {
      existing.balance = String(payload.newBalance);
      existing.version += 1;
      await this.walletBalanceRepo.save(existing);
      this.logger.log(
        `Wallet credited projection: userId=${payload.userId} newBalance=${payload.newBalance}`,
      );
    }
  }

  async onWalletDebited(payload: {
    walletId: string;
    userId: string;
    amount: number;
    currency: string;
    newBalance: number;
  }) {
    const existing = await this.walletBalanceRepo.findOne({
      where: { userId: payload.userId },
    });

    if (existing) {
      existing.balance = String(payload.newBalance);
      existing.version += 1;
      await this.walletBalanceRepo.save(existing);
      this.logger.log(
        `Wallet debited projection: userId=${payload.userId} newBalance=${payload.newBalance}`,
      );
    }
  }

  async onPaymentCreated(payload: {
    paymentId: string;
    fromUserId: string;
    toUserId: string;
    amount: number;
    currency: string;
    description?: string;
    status: string;
  }) {
    await this.paymentStatusRepo.save({
      paymentId: payload.paymentId,
      fromUserId: payload.fromUserId,
      toUserId: payload.toUserId,
      amount: String(payload.amount),
      currency: payload.currency,
      description: payload.description,
      status: payload.status,
    });
    this.logger.log(`Payment projection created: paymentId=${payload.paymentId}`);
  }

  async onPaymentStatusUpdated(payload: {
    paymentId: string;
    status: string;
  }) {
    const existing = await this.paymentStatusRepo.findOne({
      where: { paymentId: payload.paymentId },
    });

    if (existing) {
      existing.status = payload.status;
      await this.paymentStatusRepo.save(existing);
      this.logger.log(
        `Payment status updated: paymentId=${payload.paymentId} status=${payload.status}`,
      );
    }
  }

  async findWalletByUserId(userId: string): Promise<WalletBalanceView | null> {
    return this.walletBalanceRepo.findOne({ where: { userId } });
  }

  async findPaymentById(paymentId: string): Promise<PaymentStatusView | null> {
    return this.paymentStatusRepo.findOne({ where: { paymentId } });
  }
}
