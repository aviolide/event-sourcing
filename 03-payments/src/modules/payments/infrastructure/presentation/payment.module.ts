import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { PaymentEntity } from '../entities/payment.entity';
import { PaymentInfrastructure } from '../payment.infrastructure';
import { PaymentRepository } from '../../domain/repositories/payment.repository';
import { PaymentsApplication } from '../../application/payments.application';
import { PaymentsController } from './payment.controller';
import { PaymentsKafkaConsumer } from './kafka.consumer';
import { JwtStrategy } from 'src/core/guards/jwt.strategy';
import { JwtAuthGuard } from 'src/core/guards/jwt-auth.guard';
import { InboxGuard } from '@yupi/messaging';

@Module({
  imports: [
    TypeOrmModule.forFeature([PaymentEntity]),
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
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow('JWT_SECRET'),
      }),
    }),
  ],
  controllers: [PaymentsController, PaymentsKafkaConsumer],
  providers: [
    PaymentInfrastructure,
    PaymentsApplication,
    InboxGuard,
    {
      provide: PaymentRepository,
      useExisting: PaymentInfrastructure,
    },
    JwtStrategy,
    JwtAuthGuard,
  ],
  exports: [PaymentsApplication, PaymentRepository],
})
export class PaymentsModule {}
