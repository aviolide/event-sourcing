import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { WalletEntity } from '../entities/wallet.entity';
import { WalletInfrastructure } from '../wallet.infrastructure';
import { WalletRepository } from '../../domain/repositories/wallet.repository';
import { WalletApplication } from '../../application/wallet.application';
import { WalletController } from './wallet.controller';
import { WalletKafkaConsumer } from './kafka.consumer';

@Module({
  imports: [TypeOrmModule.forFeature([WalletEntity])],
  controllers: [WalletController, WalletKafkaConsumer],
  providers: [
    WalletInfrastructure,
    WalletApplication,
    {
      provide: WalletRepository,
      useExisting: WalletInfrastructure,
    },
  ],
  exports: [WalletApplication, WalletRepository],
})
export class WalletModule {}
