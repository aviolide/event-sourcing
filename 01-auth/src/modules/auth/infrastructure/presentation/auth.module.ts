import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AuthController } from './auth.controller';
import { AuthApplication } from '../../application/auth.application';

import { RefreshToken } from '../entities/auth.entity';
import { AuthInfrastructure } from '../auth.infrastructure';

import { UsersModule } from '../../../users/infrastructure/presentation/user.module';

import { JwtStrategy } from './jwt.strategy';
import { JwtAuthGuard } from './jwt-auth.guard';
import { EnvVars } from 'src/config/env.validation';
import { AuthRepository } from '../../domain/repositories/auth.repository';
import { KafkaProducer } from './kafka.producer';

@Module({
  imports: [
    TypeOrmModule.forFeature([RefreshToken]),
    ConfigModule,
    UsersModule,

    // JWT para access tokens (secret + expiresIn vienen del .env)
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvVars>): JwtModuleOptions => {
        const secret = config.get('JWT_SECRET');      
        const expiresIn = config.get('JWT_EXPIRES_IN'); 

        return {
          secret,
          signOptions: {
            expiresIn: expiresIn as any,
            algorithm: 'HS256',
          },
        };
      },
    }),

    // kafka client to emit events (USER_CREATED)
    ClientsModule.registerAsync([
      {
        name: 'AUTH_KAFKA_CLIENT',
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
  controllers: [AuthController],
  providers: [
    AuthApplication,
    AuthInfrastructure,
    {
    provide: AuthRepository,
    useExisting: AuthInfrastructure,
  },
    JwtStrategy,
    JwtAuthGuard,
    KafkaProducer,
  ],
  exports: [
    AuthApplication,
    JwtAuthGuard,
  ],
})
export class AuthModule {}