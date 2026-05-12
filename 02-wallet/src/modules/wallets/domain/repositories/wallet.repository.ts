import { Result } from 'neverthrow';
import { Wallet } from '../wallet';
import { BaseException } from '../../../../core/exceptions/base.exception';

export type WalletResult = Promise<Result<Wallet, BaseException>>;
export type VoidResult = Promise<Result<void, BaseException>>;
export type WalletTransferResult = Result<{ from: Wallet; to: Wallet }, BaseException>;

export abstract class WalletRepository {
  abstract createForUser(userId: string): WalletResult;
  abstract findByUserId(userId: string): WalletResult;
  abstract transfer(
    fromUserId: string,
    toUserId: string,
    amount: number,
    currency: string,
  ): Promise<WalletTransferResult>;
  abstract credit(
    userId: string,
    amount: number,
    currency: string,
    reason?: string,
  ): WalletResult;
}
