import { Injectable } from '@nestjs/common';

export interface WalletProjection {
  id: string;
  userId: string;
  balance: number;
  reserved: number;
  available: number;
  currency: string;
}

export abstract class ProjectionRepository {
  abstract findWalletByUserId(userId: string): Promise<WalletProjection | null>;
}

@Injectable()
export class InMemoryProjectionRepository implements ProjectionRepository {
  private readonly wallets = new Map<string, WalletProjection>();

  async findWalletByUserId(userId: string): Promise<WalletProjection | null> {
    return this.wallets.get(userId) ?? null;
  }

  seed(wallet: WalletProjection) {
    this.wallets.set(wallet.userId, wallet);
  }
}
