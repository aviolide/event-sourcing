import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

import { AppModule } from './app.module';

const logger = new Logger('LoggingBootstrap');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();

  const config = app.get(ConfigService);
  const port = config.get<number>('PORT') || 3040;

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: config.get<string>('KAFKA_CLIENT_ID') || 'logging-service',
        brokers: [config.get<string>('KAFKA_BROKER')!],
      },
      consumer: {
        groupId: config.get<string>('KAFKA_GROUP_ID')!,
      },
    },
  });

  await app.startAllMicroservices();
  await app.listen(port, () => {
    logger.log(
      `Logging Service running on http://localhost:${port}`,
      'Nest Listen',
    );
  });
}

bootstrap();
