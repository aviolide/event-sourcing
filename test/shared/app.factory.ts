import { INestApplication, ValidationPipe, Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

export interface MicroserviceConfig {
  broker: string;
  groupId: string;
  clientId?: string;
}

export interface ProviderOverride {
  provide: any;
  useValue: any;
}

export interface CreateTestAppOptions {
  imports: any[];
  connectMicroservice?: MicroserviceConfig;
  overrides?: ProviderOverride[];
  onAppCreate?: (app: INestApplication) => void;
}

export async function createTestApp(
  options: CreateTestAppOptions,
): Promise<INestApplication> {
  let builder = Test.createTestingModule({
    imports: options.imports,
  });

  if (options.overrides) {
    for (const override of options.overrides) {
      builder = builder
        .overrideProvider(override.provide)
        .useValue(override.useValue);
    }
  }

  const moduleFixture: TestingModule = await builder.compile();

  const app = moduleFixture.createNestApplication();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  if (options.onAppCreate) {
    options.onAppCreate(app);
  }

  if (options.connectMicroservice) {
    app.connectMicroservice<MicroserviceOptions>({
      transport: Transport.KAFKA,
      options: {
        client: {
          brokers: [options.connectMicroservice.broker],
          clientId: options.connectMicroservice.clientId || 'test-client',
        },
        consumer: {
          groupId: options.connectMicroservice.groupId,
        },
      },
    });

    await app.startAllMicroservices();
  }

  await app.init();

  return app;
}
