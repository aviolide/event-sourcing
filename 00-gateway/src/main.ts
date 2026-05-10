import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import { AppModule } from './app.module';
import { LoggingInterceptor } from './core/interceptors/logging.interceptor';
import { AllExceptionsFilter } from './core/filters/all-exceptions.filter';

async function bootstrap() {
  const logger = new Logger('GatewayBootstrap');
  const app = await NestFactory.create(AppModule);

  // 1) Middleware (OWASP)
  app.use(
    helmet({
      contentSecurityPolicy: false, // playground on dev
    }),
  );

  const corsOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  app.enableCors({
    origin: corsOrigins.length ? corsOrigins : true,
    credentials: true,
  });

  app.use(
    '/graphql',
    rateLimit({
      windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60000),
      max: Number(process.env.RATE_LIMIT_MAX || 120),
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  // 2) Pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      forbidUnknownValues: true,
    }),
  );

  // 3) Interceptors
  app.useGlobalInterceptors(new LoggingInterceptor());

  // 4) Filters
  app.useGlobalFilters(new AllExceptionsFilter());

  const port = Number(process.env.PORT || 3000);
  await app.listen(port);

  logger.log(`Gateway running on http://localhost:${port}/graphql`);
}
bootstrap();
