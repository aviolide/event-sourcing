import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { GatewayResolver } from './presentation/gateway.resolver';
import { DownstreamHttpClient } from './http/downstream-http.client';
import { JwtStrategy } from '../../../core/guards/jwt.strategy';
import { JwtAuthGuard } from '../../../core/guards/jwt-auth.guard';

@Module({
  imports: [
    ConfigModule,
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const nodeEnv = config.get<string>('NODE_ENV') || 'development';
        const isProd = nodeEnv === 'production';

        return {
          autoSchemaFile: isProd ? true : join(process.cwd(), 'src/schema.gql'),
          // autoSchemaFile: true,
          sortSchema: true,
          playground: !isProd,            // OWASP: disable in prod
          introspection: !isProd,         // OWASP: disable in prod

          // Context with request (to read Authorization)
          context: ({ req }) => ({ req }),

          // limits (OWASP: resource consumption)
          validationRules: [
            // Si quieres más duro luego: depth-limit / cost-analysis
          ],

          formatError: (formattedError) => {
            // dont show stack traces to client
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
    DownstreamHttpClient,
    GatewayResolver,

    // Auth
    JwtStrategy,
    JwtAuthGuard,
  ],
})
export class GraphqlGatewayModule {}
