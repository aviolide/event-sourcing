import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { SagaInstance } from './entities/saga-instance.entity';
import { SagaConsumer } from './saga.consumer';
import { SagaService } from './saga.service';
import { KafkaProducerService, InboxGuard } from '@yupi/messaging';

@Module({
  imports: [
    TypeOrmModule.forFeature([SagaInstance]),
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
  controllers: [SagaConsumer],
  providers: [SagaService, KafkaProducerService, InboxGuard],
  exports: [SagaService],
})
export class SagaModule {}
