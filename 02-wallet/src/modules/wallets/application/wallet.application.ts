import { Inject, Injectable } from '@nestjs/common';
import { WalletRepository } from '../domain/repositories/wallet.repository';

@Injectable()
export class WalletApplication {
  constructor(
    @Inject(WalletRepository)
    private readonly repository: WalletRepository,
  ) {}

  async createForUser(userId: string) {
    return this.repository.createForUser(userId);
  }

  async getByUserId(userId: string) {
    return this.repository.findByUserId(userId);
  }

  async reserve(
    userId: string,
    amount: number,
    currency: string,
    transferId: string,
  ) {
    return this.repository.reserve(userId, amount, currency, transferId);
  }

  async credit(
    userId: string,
    amount: number,
    currency: string,
    transferId: string,
  ) {
    return this.repository.credit(userId, amount, currency, transferId);
  }

  async release(
    userId: string,
    amount: number,
    currency: string,
    transferId: string,
  ) {
    return this.repository.release(userId, amount, currency, transferId);
  }

  async commit(
    userId: string,
    amount: number,
    currency: string,
    transferId: string,
  ) {
    return this.repository.commit(userId, amount, currency, transferId);
  }
}
