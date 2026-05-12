import { Result } from 'neverthrow';
import { Wallet } from '../wallet';
import { BaseException } from '../../../../core/exceptions/base.exception';

export type WalletResult = Promise<Result<Wallet, BaseException>>;
export type VoidResult = Promise<Result<void, BaseException>>;

export abstract class WalletRepository {
  abstract createForUser(userId: string): WalletResult;
  abstract findByUserId(userId: string): WalletResult;
  abstract reserve(
    userId: string,
    amount: number,
    currency: string,
    transferId: string,
  ): VoidResult;
  abstract credit(
    userId: string,
    amount: number,
    currency: string,
    transferId: string,
  ): VoidResult;
  abstract release(
    userId: string,
    amount: number,
    currency: string,
    transferId: string,
  ): VoidResult;
  abstract commit(
    userId: string,
    amount: number,
    currency: string,
    transferId: string,
  ): VoidResult;
}
