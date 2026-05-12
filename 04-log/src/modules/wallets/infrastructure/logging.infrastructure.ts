import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { err, ok } from 'neverthrow';

import { LoggingRepository, LoggingResult, LoggingTransferResult } from '../domain/repositories/logging.repository';
import { Logging } from '../domain/logging';
import { LoggingEntity } from './entities/logging.entity';
import {
  LoggingGetDatabaseException,
  LoggingSaveDatabaseException,
  LoggingNotFoundException,
  LoggingInsufficientFundsException,
  LoggingTransferDatabaseException,
} from '../../../core/exceptions/logging.exception';

@Injectable()
export class LoggingInfrastructure implements LoggingRepository {
  constructor(
    @InjectRepository(LoggingEntity)
    private readonly repository: Repository<LoggingEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async createForUser(userId: string): LoggingResult {
    try {
      const existing = await this.repository.findOne({ where: { userId } });
      if (existing) {
        const logging = this.toDomain(existing);
        return ok(logging);
      }

      const entity = this.repository.create({
        userId,
        balance: '0',
        currency: 'PEN',
      });

      const saved = await this.repository.save(entity);
      const logging = this.toDomain(saved);
      return ok(logging);
    } catch (error: any) {
      return err(new LoggingSaveDatabaseException(error.message, error.stack));
    }
  }

  async findByUserId(userId: string): LoggingResult {
    try {
      const entity = await this.repository.findOne({ where: { userId } });
      if (!entity) {
        return err(new LoggingNotFoundException(userId));
      }

      return ok(this.toDomain(entity));
    } catch (error: any) {
      return err(new LoggingGetDatabaseException(error.message, error.stack));
    }
  }

  async transfer(
    fromUserId: string,
    toUserId: string,
    amount: number,
    currency: string,
  ): Promise<LoggingTransferResult> {
    if (fromUserId === toUserId) {
      return err(
        new LoggingInsufficientFundsException(
          'Cannot transfer to the same user',
        ),
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const loggingRepo = queryRunner.manager.getRepository(LoggingEntity);

      // Lock loggings to avoid double spend
      const fromLogging = await loggingRepo.findOne({
        where: { userId: fromUserId, currency },
        lock: { mode: 'pessimistic_write' },
      });
      console.log('from logging', fromLogging)

      if (!fromLogging) {
        throw new LoggingNotFoundException(
          `Logging not found for userId=${fromUserId} currency=${currency}`,
        );
      }

      const toLogging = await loggingRepo.findOne({
        where: { userId: toUserId, currency },
        lock: { mode: 'pessimistic_write' },
      });

      console.log('to logging', toLogging)
      if (!toLogging) {
        throw new LoggingNotFoundException(
          `Logging not found for userId=${toUserId} currency=${currency}`,
        );
      }
      
      const fromBalance = Number(fromLogging.balance);
      const toBalance = Number(toLogging.balance);

      if (Number.isNaN(fromBalance) || Number.isNaN(toBalance)) {
        throw new LoggingTransferDatabaseException(
          'Invalid logging balance format',
        );
      }

      
      // Validate funds
      if (fromBalance < amount) {
        throw new LoggingInsufficientFundsException(
          `Insufficient funds in logging of userId=${fromUserId}`,
        );
      }

      // Update balances (convert back to string for DB)
      fromLogging.balance = String(fromBalance - amount);
      toLogging.balance = String(toBalance + amount);

      await loggingRepo.save(fromLogging);
      await loggingRepo.save(toLogging);

      await queryRunner.commitTransaction();

      // Map to domain
      const fromDomain = new Logging({
        id: fromLogging.id,
        userId: fromLogging.userId,
        balance: Number(fromLogging.balance),
        currency: fromLogging.currency,
      });

      const toDomain = new Logging({
        id: toLogging.id,
        userId: toLogging.userId,
        balance: Number(toLogging.balance),
        currency: toLogging.currency,
      });

      return ok({ from: fromDomain, to: toDomain });
    } catch (error: any) {
      console.log("🚀 ~ LoggingInfrastructure ~ error:", error)
      await queryRunner.rollbackTransaction();

      if (
        error instanceof LoggingNotFoundException ||
        error instanceof LoggingInsufficientFundsException
      ) {
        return err(error);
      }

      return err(
        new LoggingTransferDatabaseException(error.message, error.stack),
      );
    } finally {
      await queryRunner.release();
    }
  }

  private toDomain(entity: LoggingEntity): Logging {
    return new Logging({
      id: entity.id,
      userId: entity.userId,
      balance: Number(entity.balance),
      currency: entity.currency,
    });
  }
}