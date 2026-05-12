import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { err, ok } from 'neverthrow';

import { WalletRepository, WalletResult, WalletTransferResult } from '../domain/repositories/wallet.repository';
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
  WalletTransferDatabaseException,
} from '../../../core/exceptions/wallet.exception';
import { randomUUID } from 'node:crypto';

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
    private readonly dataSource: DataSource,
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

      await this.updateBalanceView(saved.id, userId, 0, 'PEN', 1);

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

  async transfer(
    fromUserId: string,
    toUserId: string,
    amount: number,
    currency: string,
  ): Promise<WalletTransferResult> {
    if (fromUserId === toUserId) {
      return err(
        new WalletInsufficientFundsException('Cannot transfer to the same user'),
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const walletRepo = queryRunner.manager.getRepository(WalletEntity);

      const fromEntity = await walletRepo.findOne({
        where: { userId: fromUserId, currency },
        lock: { mode: 'pessimistic_write' },
      });

      if (!fromEntity) {
        throw new WalletNotFoundException(
          `Wallet not found for userId=${fromUserId} currency=${currency}`,
        );
      }

      const toEntity = await walletRepo.findOne({
        where: { userId: toUserId, currency },
        lock: { mode: 'pessimistic_write' },
      });

      if (!toEntity) {
        throw new WalletNotFoundException(
          `Wallet not found for userId=${toUserId} currency=${currency}`,
        );
      }

      const fromWallet = await this.rebuildWallet(
        fromEntity.id,
        fromUserId,
        queryRunner.manager,
      );
      const toWallet = await this.rebuildWallet(
        toEntity.id,
        toUserId,
        queryRunner.manager,
      );

      if (!fromWallet.canDebit(amount)) {
        throw new WalletInsufficientFundsException(
          `Insufficient funds in wallet of userId=${fromUserId}`,
        );
      }

      const transferId = randomUUID();
      const fromVersion = fromWallet.getVersion() + 1;
      const toVersion = toWallet.getVersion() + 1;

      const ledgerRepo = queryRunner.manager.getRepository(WalletLedgerEntry);

      await ledgerRepo.save({
        walletId: fromEntity.id,
        eventType: 'FundsDebited',
        payload: { amount, transferId, reason: 'transfer' },
        version: fromVersion,
      });

      await ledgerRepo.save({
        walletId: toEntity.id,
        eventType: 'FundsCredited',
        payload: { amount, transferId, reason: 'transfer' },
        version: toVersion,
      });

      await this.updateBalanceView(
        fromEntity.id,
        fromUserId,
        fromWallet.getBalance() - amount,
        currency,
        fromVersion,
        queryRunner.manager,
      );
      await this.updateBalanceView(
        toEntity.id,
        toUserId,
        toWallet.getBalance() + amount,
        currency,
        toVersion,
        queryRunner.manager,
      );

      await queryRunner.commitTransaction();

      return ok({ from: fromWallet, to: toWallet });
    } catch (error: any) {
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

  async credit(
    userId: string,
    amount: number,
    currency: string,
    reason?: string,
  ): WalletResult {
    try {
      const entity = await this.repository.findOne({
        where: { userId, currency },
      });
      if (!entity) {
        return err(new WalletNotFoundException(userId));
      }

      const wallet = await this.rebuildWallet(entity.id, userId);
      const version = wallet.getVersion() + 1;
      const transferId = randomUUID();

      await this.ledgerRepo.save({
        walletId: entity.id,
        eventType: 'FundsCredited',
        payload: { amount, transferId, reason: reason || 'refill' },
        version,
      });

      await this.updateBalanceView(
        entity.id,
        userId,
        wallet.getBalance() + amount,
        currency,
        version,
      );

      return ok(wallet);
    } catch (error: any) {
      return err(new WalletTransferDatabaseException(error.message, error.stack));
    }
  }

  private async rebuildWallet(
    walletId: string,
    userId: string,
    manager?: any,
  ): Promise<Wallet> {
    const ledgerRepo = manager
      ? manager.getRepository(WalletLedgerEntry)
      : this.ledgerRepo;

    const snapshot = await this.snapshotRepo.findOne({
      where: { walletId },
    });

    const fromVersion = snapshot ? snapshot.version : 0;

    const events = await ledgerRepo.find({
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
        version: wallet.getVersion(),
      });
    }

    return wallet;
  }

  private async updateBalanceView(
    walletId: string,
    userId: string,
    balance: number,
    currency: string,
    version: number,
    manager?: any,
  ) {
    const repo = manager
      ? manager.getRepository(WalletBalanceView)
      : this.balanceViewRepo;

    const existing = await repo.findOne({ where: { userId } });
    if (existing) {
      existing.balance = String(balance);
      existing.version = version;
      await repo.save(existing);
    } else {
      await repo.save({
        walletId,
        userId,
        currency,
        balance: String(balance),
        version,
      });
    }
  }
}
