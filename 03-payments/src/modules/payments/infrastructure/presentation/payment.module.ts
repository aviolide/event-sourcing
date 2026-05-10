import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { PaymentEntity } from '../entities/payment.entity';
import { PaymentInfrastructure } from '../payment.infrastructure';
import { PaymentRepository } from '../../domain/repositories/payment.repository';
import { PaymentsApplication } from '../../application/payments.application';
import { PaymentsController } from './payment.controller';
import { PaymentsKafkaProducer } from './kafka.producer';
import { PaymentsKafkaConsumer } from './kafka.consumer';
import { JwtStrategy } from 'src/core/guards/jwt.strategy';
import { JwtAuthGuard } from 'src/core/guards/jwt-auth.guard';


@Module({
  imports: [
    TypeOrmModule.forFeature([PaymentEntity]),
    ConfigModule,
    HttpModule,
    ClientsModule.registerAsync([
      {
        name: 'PAYMENTS_KAFKA_CLIENT',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.KAFKA,
          options: {
            client: {
              clientId:
              // 'payments-service-producer-client',
                config.get<string>('KAFKA_CLIENT_ID'),
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
    PaymentsKafkaProducer,
    {
      provide: PaymentRepository,
      useExisting: PaymentInfrastructure,
    },
    JwtStrategy,      
    JwtAuthGuard
  ],
  exports: [PaymentsApplication, PaymentRepository],
})
export class PaymentsModule {}