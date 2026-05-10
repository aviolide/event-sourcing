import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { createTestApp } from '../../shared/app.factory';
import { truncateAll } from '../../shared/db.helper';
import { assertWalletCount } from '../../shared/invariants';
import { createKafkaProducer, publishEvent, disconnectKafka } from '../../shared/kafka.helper';
import { waitUntil } from '../../shared/wait-until';
import { startTestEnvironment, stopTestEnvironment, getConfig } from '../../shared/containers/test-environment';

import { AppModule } from '../../../02-wallet/src/app.module';

describe('Wallet Kafka Consumer Flow E2E', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let config: ReturnType<typeof getConfig>;

  beforeAll(async () => {
    config = await startTestEnvironment();

    Object.assign(process.env, {
      PORT: '3021',
      SERVICE_NAME: 'wallet-test-service',
      DB_HOST: config.postgres.host,
      DB_PORT: String(config.postgres.port),
      DB_NAME: config.postgres.database,
      DB_USERNAME: config.postgres.username,
      DB_PASSWORD: config.postgres.password,
      KAFKA_BROKER: config.kafka.broker,
      KAFKA_CLIENT_ID: 'wallet-kafka-test-client',
      KAFKA_GROUP_ID: 'wallet-kafka-test-group',
      NODE_ENV: 'test',
    });

    app = await createTestApp({
      imports: [AppModule],
      connectMicroservice: {
        broker: config.kafka.broker,
        groupId: 'wallet-kafka-test-group',
        clientId: 'wallet-kafka-test-client',
      },
    });

    dataSource = app.get(DataSource);

    await createKafkaProducer(config.kafka.broker);
  }, 120000);

  afterAll(async () => {
    if (app) await app.close();
    await disconnectKafka();
    await stopTestEnvironment();
  }, 60000);

  beforeEach(async () => {
    await truncateAll(dataSource);
  });

  it('should create wallet when user.created event is received', async () => {
    const userId = 'c3333333-3333-3333-3333-333333333333';

    await publishEvent('user.created', userId, {
      id: userId,
      email: 'kafka-user@test.com',
      phone: '+1111111111',
      fullName: 'Kafka User',
    });

    await waitUntil(
      async () => {
        const rows = await dataSource.query(
          `SELECT * FROM wallets WHERE "userId" = $1`,
          [userId],
        );
        return rows.length > 0;
      },
      { timeout: 20000, message: 'Wallet not created after user.created event' },
    );

    const rows = await dataSource.query(
      `SELECT * FROM wallets WHERE "userId" = $1`,
      [userId],
    );
    expect(rows).toHaveLength(1);
    expect(parseFloat(rows[0].balance)).toBe(0);
    expect(rows[0].currency).toBe('PEN');
  });

  it('should be idempotent when receiving duplicate user.created event', async () => {
    const userId = 'd4444444-4444-4444-4444-444444444444';

    await publishEvent('user.created', userId, {
      id: userId,
      email: 'dup-user@test.com',
      phone: '+2222222222',
      fullName: 'Dup User',
    });

    await waitUntil(
      async () => {
        const rows = await dataSource.query(
          `SELECT * FROM wallets WHERE "userId" = $1`,
          [userId],
        );
        return rows.length > 0;
      },
      { timeout: 20000, message: 'Wallet not created after first user.created' },
    );

    await publishEvent('user.created', userId, {
      id: userId,
      email: 'dup-user@test.com',
      phone: '+2222222222',
      fullName: 'Dup User',
    });

    await new Promise((resolve) => setTimeout(resolve, 3000));

    await assertWalletCount(dataSource, 1);

    const rows = await dataSource.query(
      `SELECT * FROM wallets WHERE "userId" = $1`,
      [userId],
    );
    expect(rows).toHaveLength(1);
    expect(parseFloat(rows[0].balance)).toBe(0);
  });
});
