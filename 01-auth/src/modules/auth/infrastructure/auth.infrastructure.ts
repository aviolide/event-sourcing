import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { err, ok } from 'neverthrow';

import { AuthRepository, RefreshTokenResult, VoidResult } from '../domain/repositories/auth.repository';
import { RefreshToken } from './entities/auth.entity';
import { UserGetDatabaseException, UserSaveDatabaseException } from '../../../core/exceptions/auth.exception';

@Injectable()
export class AuthInfrastructure implements AuthRepository {
  constructor(
    @InjectRepository(RefreshToken)
    private readonly repository: Repository<RefreshToken>,
  ) {}

  async saveToken(token: RefreshToken): RefreshTokenResult {
    try {
      const saved = await this.repository.save(token);
      return ok(saved);
    } catch (error: any) {
      return err(
        new UserSaveDatabaseException(error.message, error.stack),
      );
    }
  }

  async revokeToken(tokenId: string): VoidResult {
    try {
      await this.repository.update(tokenId, { revoked: true });
      return ok(undefined);
    } catch (error: any) {
      return err(
        new UserSaveDatabaseException(error.message, error.stack),
      );
    }
  }

  async findValidToken(token: string, userId: string) {
    try {
      const refresh = await this.repository.findOne({
        where: {
          token,
          revoked: false,
          user: { id: userId },
        },
        relations: ['user'],
      });

      return ok(refresh);
    } catch (error: any) {
      return err(
        new UserGetDatabaseException(error.message, error.stack),
      );
    }
  }
}