import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { WalletEntity } from '../entities/wallet.entity';
import { WalletLedgerEntry } from '../entities/wallet-ledger.entity';
import { WalletSnapshot } from '../entities/wallet-snapshot.entity';
import { WalletBalanceView } from '../entities/wallet-balance.projection';
import { WalletInfrastructure } from '../wallet.infrastructure';
import { WalletRepository } from '../../domain/repositories/wallet.repository';
import { WalletApplication } from '../../application/wallet.application';
import { WalletCommandConsumer } from './kafka.consumer';
import { KafkaProducerService, InboxGuard } from '@yupi/messaging';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WalletEntity,
      WalletLedgerEntry,
      WalletSnapshot,
      WalletBalanceView,
    ]),
    ConfigModule,
    ClientsModule.registerAsync([
      {
        name: 'KAFKA_CLIENT',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.KAFKA,
          options: {
            client: {
              clientId: config.get<string>('KAFKA_CLIENT_ID'),
              brokers: [config.get<string>('KAFKA_BROKER')!],
            },
            producerOnlyMode: true,
          },
        }),
      },
    ]),
  ],
  controllers: [WalletCommandConsumer],
  providers: [
    WalletInfrastructure,
    WalletApplication,
    KafkaProducerService,
    InboxGuard,
    {
      provide: WalletRepository,
      useExisting: WalletInfrastructure,
    },
  ],
  exports: [WalletApplication, WalletRepository],
})
export class WalletModule {}
