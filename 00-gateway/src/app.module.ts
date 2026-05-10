import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { envSchema } from './config/env.validation';
import { GraphqlGatewayModule } from './modules/gateway/infrastructure/gateway.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (cfg) => envSchema.parse(cfg),
    }),
    GraphqlGatewayModule,
  ],
})
export class AppModule {}
