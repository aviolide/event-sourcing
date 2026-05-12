import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';

import { GatewayResolver } from './presentation/gateway.resolver';
import { AuthHttpClient } from './http/auth-http.client';
import { JwtStrategy } from '../../../core/guards/jwt.strategy';
import { JwtAuthGuard } from '../../../core/guards/jwt-auth.guard';
import { KafkaProducerService } from '@yupi/messaging';
import {
  ProjectionRepository,
  InMemoryProjectionRepository,
} from './projections/projection.repository';

@Module({
  imports: [
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
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const nodeEnv = config.get<string>('NODE_ENV') || 'development';
        const isProd = nodeEnv === 'production';

        return {
          autoSchemaFile: isProd ? true : join(process.cwd(), 'src/schema.gql'),
          sortSchema: true,
          playground: !isProd,
          introspection: !isProd,
          context: ({ req }) => ({ req }),
          validationRules: [],
          formatError: (formattedError) => {
            return {
              message: formattedError.message,
              extensions: {
                code: formattedError.extensions?.code,
              },
            };
          },
        };
      },
    }),
  ],
  providers: [
    AuthHttpClient,
    KafkaProducerService,
    GatewayResolver,
    {
      provide: ProjectionRepository,
      useClass: InMemoryProjectionRepository,
    },
    JwtStrategy,
    JwtAuthGuard,
  ],
})
export class GraphqlGatewayModule {}
