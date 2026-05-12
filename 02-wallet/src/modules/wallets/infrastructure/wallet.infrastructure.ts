import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { err, ok } from 'neverthrow';

import { WalletRepository, WalletResult, VoidResult } from '../domain/repositories/wallet.repository';
import { Wallet } from '../domain/wallet';
import { WalletEntity } from './entities/wallet.entity';
import { WalletLedgerEntry } from './entities/wallet-ledger.entity';
import { WalletSnapshot } from './entities/wallet-snapshot.entity';
import { WalletBalanceView } from './entities/wallet-balance.projection';
import {
  WalletGetDatabaseException,
  WalletSaveDatabaseException,
  WalletNotFoundException,
  WalletInsufficientFundsException,
} from '../../../core/exceptions/wallet.exception';

@Injectable()
export class WalletInfrastructure implements WalletRepository {
  constructor(
    @InjectRepository(WalletEntity)
    private readonly repository: Repository<WalletEntity>,
    @InjectRepository(WalletLedgerEntry)
    private readonly ledgerRepo: Repository<WalletLedgerEntry>,
    @InjectRepository(WalletSnapshot)
    private readonly snapshotRepo: Repository<WalletSnapshot>,
    @InjectRepository(WalletBalanceView)
    private readonly balanceViewRepo: Repository<WalletBalanceView>,
  ) {}

  async createForUser(userId: string): WalletResult {
    try {
      const existing = await this.repository.findOne({ where: { userId } });
      if (existing) {
        const wallet = await this.rebuildWallet(existing.id, userId);
        return ok(wallet);
      }

      const entity = this.repository.create({
        userId,
        balance: '0',
        currency: 'PEN',
      });

      const saved = await this.repository.save(entity);

      await this.ledgerRepo.save({
        walletId: saved.id,
        eventType: 'WalletCreated',
        payload: { userId, currency: 'PEN', initialBalance: 0 },
        version: 1,
      });

      await this.updateBalanceView(saved.id, userId, 0, 0, 'PEN', 1);

      const wallet = Wallet.create(saved.id, userId, 'PEN');
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

      const wallet = await this.rebuildWallet(entity.id, userId);
      return ok(wallet);
    } catch (error: any) {
      return err(new WalletGetDatabaseException(error.message, error.stack));
    }
  }

  async reserve(
    userId: string,
    amount: number,
    currency: string,
    transferId: string,
  ): VoidResult {
    try {
      const entity = await this.repository.findOne({ where: { userId, currency } });
      if (!entity) {
        return err(new WalletNotFoundException(userId));
      }

      const wallet = await this.rebuildWallet(entity.id, userId);
      if (!wallet.canReserve(amount)) {
        return err(
          new WalletInsufficientFundsException(
            `Insufficient available funds for userId=${userId}: available=${wallet.getAvailable()}, requested=${amount}`,
          ),
        );
      }

      const version = wallet.getVersion() + 1;

      await this.ledgerRepo.save({
        walletId: entity.id,
        eventType: 'FundsReserved',
        payload: { amount, transferId, currency },
        version,
      });

      await this.updateBalanceView(
        entity.id,
        userId,
        wallet.getBalance(),
        wallet.getReserved() + amount,
        currency,
        version,
      );

      return ok(undefined);
    } catch (error: any) {
      return err(new WalletSaveDatabaseException(error.message, error.stack));
    }
  }

  async credit(
    userId: string,
    amount: number,
    currency: string,
    transferId: string,
  ): VoidResult {
    try {
      const entity = await this.repository.findOne({ where: { userId, currency } });
      if (!entity) {
        return err(new WalletNotFoundException(userId));
      }

      const wallet = await this.rebuildWallet(entity.id, userId);
      const version = wallet.getVersion() + 1;

      await this.ledgerRepo.save({
        walletId: entity.id,
        eventType: 'FundsCredited',
        payload: { amount, transferId, currency },
        version,
      });

      await this.updateBalanceView(
        entity.id,
        userId,
        wallet.getBalance() + amount,
        wallet.getReserved(),
        currency,
        version,
      );

      return ok(undefined);
    } catch (error: any) {
      return err(new WalletSaveDatabaseException(error.message, error.stack));
    }
  }

  async release(
    userId: string,
    amount: number,
    currency: string,
    transferId: string,
  ): VoidResult {
    try {
      const entity = await this.repository.findOne({ where: { userId, currency } });
      if (!entity) {
        return err(new WalletNotFoundException(userId));
      }

      const wallet = await this.rebuildWallet(entity.id, userId);
      const version = wallet.getVersion() + 1;

      await this.ledgerRepo.save({
        walletId: entity.id,
        eventType: 'FundsReleased',
        payload: { amount, transferId, currency },
        version,
      });

      await this.updateBalanceView(
        entity.id,
        userId,
        wallet.getBalance(),
        Math.max(0, wallet.getReserved() - amount),
        currency,
        version,
      );

      return ok(undefined);
    } catch (error: any) {
      return err(new WalletSaveDatabaseException(error.message, error.stack));
    }
  }

  async commit(
    userId: string,
    amount: number,
    currency: string,
    transferId: string,
  ): VoidResult {
    try {
      const entity = await this.repository.findOne({ where: { userId, currency } });
      if (!entity) {
        return err(new WalletNotFoundException(userId));
      }

      const wallet = await this.rebuildWallet(entity.id, userId);
      const version = wallet.getVersion() + 1;

      await this.ledgerRepo.save({
        walletId: entity.id,
        eventType: 'TransferCommitted',
        payload: { amount, transferId, currency },
        version,
      });

      await this.updateBalanceView(
        entity.id,
        userId,
        wallet.getBalance() - amount,
        Math.max(0, wallet.getReserved() - amount),
        currency,
        version,
      );

      return ok(undefined);
    } catch (error: any) {
      return err(new WalletSaveDatabaseException(error.message, error.stack));
    }
  }

  private async rebuildWallet(
    walletId: string,
    userId: string,
  ): Promise<Wallet> {
    const snapshot = await this.snapshotRepo.findOne({
      where: { walletId },
    });

    const events = await this.ledgerRepo.find({
      where: { walletId },
      order: { version: 'ASC' },
    });

    const wallet = Wallet.create(walletId, userId);
    wallet.applyEvents(
      events.map((e) => ({ eventType: e.eventType, payload: e.payload })),
    );

    if (events.length > 0 && events.length % 100 === 0) {
      await this.snapshotRepo.save({
        walletId,
        userId,
        currency: wallet.getCurrency(),
        balance: String(wallet.getBalance()),
        reserved: String(wallet.getReserved()),
        version: wallet.getVersion(),
      });
    }

    return wallet;
  }

  private async updateBalanceView(
    walletId: string,
    userId: string,
    balance: number,
    reserved: number,
    currency: string,
    version: number,
  ) {
    const existing = await this.balanceViewRepo.findOne({ where: { userId } });
    if (existing) {
      existing.balance = String(balance);
      existing.reserved = String(reserved);
      existing.version = version;
      await this.balanceViewRepo.save(existing);
    } else {
      await this.balanceViewRepo.save({
        walletId,
        userId,
        currency,
        balance: String(balance),
        reserved: String(reserved),
        version,
      });
    }
  }
}
