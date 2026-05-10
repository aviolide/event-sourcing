import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger, ValidationPipe } from '@nestjs/common';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';

const logger = new Logger('Bootstrap');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      transform: true,
    }),
  );

  const config = app.get(ConfigService);
  const port = config.get('PORT') || 3020;

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        brokers: [config.get<string>('KAFKA_BROKER')!]
      },
      consumer: {
        groupId: config.get<string>('KAFKA_GROUP_ID')!
      },
    },
  });

  await app.startAllMicroservices();
  await app.listen(port, () => {
    logger.log(
      `Wallet Service running on http://localhost:${port}`,
      'Nest Listen',
    );
  });
}
bootstrap();
