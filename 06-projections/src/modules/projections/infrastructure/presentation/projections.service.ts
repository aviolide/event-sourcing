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
        reserved: '0',
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
  }) {
    const existing = await this.walletBalanceRepo.findOne({
      where: { userId: payload.userId },
    });

    if (existing) {
      const newBalance = Number(existing.balance) + payload.amount;
      existing.balance = String(newBalance);
      await this.walletBalanceRepo.save(existing);
      this.logger.log(
        `Wallet credited projection: userId=${payload.userId} balance=${newBalance}`,
      );
    }
  }

  async onWalletCommitted(payload: {
    walletId: string;
    userId: string;
    amount: number;
    currency: string;
  }) {
    const existing = await this.walletBalanceRepo.findOne({
      where: { userId: payload.userId },
    });

    if (existing) {
      const newBalance = Number(existing.balance) - payload.amount;
      const newReserved = Math.max(0, Number(existing.reserved) - payload.amount);
      existing.balance = String(newBalance);
      existing.reserved = String(newReserved);
      await this.walletBalanceRepo.save(existing);
      this.logger.log(
        `Wallet committed projection: userId=${payload.userId} balance=${newBalance} reserved=${newReserved}`,
      );
    }
  }

  async onWalletReleased(payload: {
    walletId: string;
    userId: string;
    amount: number;
    currency: string;
  }) {
    const existing = await this.walletBalanceRepo.findOne({
      where: { userId: payload.userId },
    });

    if (existing) {
      const newReserved = Math.max(0, Number(existing.reserved) - payload.amount);
      existing.reserved = String(newReserved);
      await this.walletBalanceRepo.save(existing);
      this.logger.log(
        `Wallet released projection: userId=${payload.userId} reserved=${newReserved}`,
      );
    }
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
    } else {
      await this.paymentStatusRepo.save({
        paymentId: payload.paymentId,
        fromUserId: payload.paymentId,
        toUserId: payload.paymentId,
        amount: '0',
        currency: 'PEN',
        status: payload.status,
      });
      this.logger.log(
        `Payment projection created on status update: paymentId=${payload.paymentId}`,
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
