import { Inject, Injectable } from '@nestjs/common';
import { WalletRepository, WalletTransferResult } from '../domain/repositories/wallet.repository';

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

  async transfer(
    fromUserId: string,
    toUserId: string,
    amount: number,
    currency: string,
  ): Promise<WalletTransferResult> {
    return this.repository.transfer(fromUserId, toUserId, amount, currency);
  }

}
