import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UserEntity } from '../entities/user.entity';
import { UserInfrastructure } from '../user.infrastructure';
import { UserRepository } from '../../domain/repositories/user.repository';
import { UserApplication } from '../../application/user.application';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity])],
  providers: [
    UserInfrastructure,
    UserApplication,
    {
      provide: UserRepository,
      useExisting: UserInfrastructure,
    },
  ],
  exports: [UserApplication, UserRepository],
})
export class UsersModule {}