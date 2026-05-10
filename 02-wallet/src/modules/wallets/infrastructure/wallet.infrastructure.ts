import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { err, ok } from 'neverthrow';

import { WalletRepository, WalletResult, WalletTransferResult } from '../domain/repositories/wallet.repository';
import { Wallet } from '../domain/wallet';
import { WalletEntity } from './entities/wallet.entity';
import {
  WalletGetDatabaseException,
  WalletSaveDatabaseException,
  WalletNotFoundException,
  WalletInsufficientFundsException,
  WalletTransferDatabaseException,
} from '../../../core/exceptions/wallet.exception';

@Injectable()
export class WalletInfrastructure implements WalletRepository {
  constructor(
    @InjectRepository(WalletEntity)
    private readonly repository: Repository<WalletEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async createForUser(userId: string): WalletResult {
    try {
      const existing = await this.repository.findOne({ where: { userId } });
      if (existing) {
        const wallet = this.toDomain(existing);
        return ok(wallet);
      }

      const entity = this.repository.create({
        userId,
        balance: '0',
        currency: 'PEN',
      });

      const saved = await this.repository.save(entity);
      const wallet = this.toDomain(saved);
      return ok(wallet);
    } catch (error: any) {
      return err(new WalletSaveDatabaseException(error.message, error.stack));
    }
  }

  async findByUserId(userId: string): WalletResult {
    try {
      const entity = await this.repository.findOne({ where: { userId } });
      if (!entity) {
        return err(new WalletNotFoundException(userId));
      }

      return ok(this.toDomain(entity));
    } catch (error: any) {
      return err(new WalletGetDatabaseException(error.message, error.stack));
    }
  }

  async transfer(
    fromUserId: string,
    toUserId: string,
    amount: number,
    currency: string,
  ): Promise<WalletTransferResult> {
    if (fromUserId === toUserId) {
    return err(
      new WalletInsufficientFundsException(
        'Cannot transfer to the same user',
      ),
    );
  }

  const queryRunner = this.dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    const walletRepo = queryRunner.manager.getRepository(WalletEntity);

    // Lock wallets to avoid double spend
    const fromWallet = await walletRepo.findOne({
      where: { userId: fromUserId, currency },
      lock: { mode: 'pessimistic_write' },
    });

    if (!fromWallet) {
      throw new WalletNotFoundException(
        `Wallet not found for userId=${fromUserId} currency=${currency}`,
      );
    }

    const toWallet = await walletRepo.findOne({
      where: { userId: toUserId, currency },
      lock: { mode: 'pessimistic_write' },
    });

    if (!toWallet) {
      throw new WalletNotFoundException(
        `Wallet not found for userId=${toUserId} currency=${currency}`,
      );
    }
    
    const fromBalance = Number(fromWallet.balance);
    const toBalance = Number(toWallet.balance);

    if (Number.isNaN(fromBalance) || Number.isNaN(toBalance)) {
      throw new WalletTransferDatabaseException(
        'Invalid wallet balance format',
      );
    }

    // Validate funds
    if (fromBalance < amount) {
      throw new WalletInsufficientFundsException(
        `Insufficient funds in wallet of userId=${fromUserId}`,
      );
    }

    // Update balances (convert back to string for DB)
    fromWallet.balance = String(fromBalance - amount);
    toWallet.balance = String(toBalance + amount);

    await walletRepo.save(fromWallet);
    await walletRepo.save(toWallet);

    await queryRunner.commitTransaction();

    // Map to domain
    const fromDomain = new Wallet({
      id: fromWallet.id,
      userId: fromWallet.userId,
      balance: Number(fromWallet.balance),
      currency: fromWallet.currency,
    });

    const toDomain = new Wallet({
      id: toWallet.id,
      userId: toWallet.userId,
      balance: Number(toWallet.balance),
      currency: toWallet.currency,
    });

    return ok({ from: fromDomain, to: toDomain });
  } catch (error: any) {
    console.log("🚀 ~ WalletInfrastructure ~ error:", error)
    await queryRunner.rollbackTransaction();

    if (
      error instanceof WalletNotFoundException ||
      error instanceof WalletInsufficientFundsException
    ) {
      return err(error);
    }

    return err(
      new WalletTransferDatabaseException(error.message, error.stack),
    );
  } finally {
    await queryRunner.release();
  }
  }

  private toDomain(entity: WalletEntity): Wallet {
    return new Wallet({
      id: entity.id,
      userId: entity.userId,
      balance: Number(entity.balance),
      currency: entity.currency,
    });
  }
}