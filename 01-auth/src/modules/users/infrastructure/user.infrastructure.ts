import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { err, ok } from 'neverthrow';

import { UserRepository, UserResult, OptionalUserResult } from '../domain/repositories/user.repository';
import { User } from '../domain/user';
import { UserEntity } from './entities/user.entity';
import {
  UserGetDatabaseException,
  UserSaveDatabaseException,
} from '../../../core/exceptions/auth.exception';

@Injectable()
export class UserInfrastructure implements UserRepository {
  constructor(
    @InjectRepository(UserEntity)
    private readonly repository: Repository<UserEntity>,
  ) {}

  async save(user: User): UserResult {
    try {
      const props = user.properties();
      const entity = this.repository.create(props);
      const saved = await this.repository.save(entity);

      return ok(new User(saved));
    } catch (error: any) {
      return err(
        new UserSaveDatabaseException(error.message, error.stack),
      );
    }
  }

  async findByEmail(email: string): OptionalUserResult {
    try {
      const entity = await this.repository.findOne({ where: { email } });
      return ok(entity ? new User(entity) : null);
    } catch (error: any) {
      return err(
        new UserGetDatabaseException(error.message, error.stack),
      );
    }
  }

  async findById(id: string): OptionalUserResult {
    try {
      const entity = await this.repository.findOne({ where: { id } });
      return ok(entity ? new User(entity) : null);
    } catch (error: any) {
      return err(
        new UserGetDatabaseException(error.message, error.stack),
      );
    }
  }
}