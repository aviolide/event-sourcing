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

describe('Kafka Reliability Flow E2E', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let config: ReturnType<typeof getConfig>;

  beforeAll(async () => {
    config = await startTestEnvironment();

    Object.assign(process.env, {
      PORT: '3023',
      SERVICE_NAME: 'wallet-kafka-reliability-test',
      DB_HOST: config.postgres.host,
      DB_PORT: String(config.postgres.port),
      DB_NAME: config.postgres.database,
      DB_USERNAME: config.postgres.username,
      DB_PASSWORD: config.postgres.password,
      KAFKA_BROKER: config.kafka.broker,
      KAFKA_CLIENT_ID: 'wallet-reliability-test-client',
      KAFKA_GROUP_ID: 'wallet-reliability-test-group',
      NODE_ENV: 'test',
    });

    app = await createTestApp({
      imports: [AppModule],
      connectMicroservice: {
        broker: config.kafka.broker,
        groupId: 'wallet-reliability-test-group',
        clientId: 'wallet-reliability-test-client',
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

  it('should handle duplicate user.created events idempotently', async () => {
    const userId = 'r1111111-1111-1111-1111-111111111111';

    await publishEvent('user.created', userId, {
      id: userId,
      email: 'dup1@test.com',
      phone: '+1111111111',
      fullName: 'Dup Test 1',
    });

    await waitUntil(
      async () => {
        const rows = await dataSource.query(
          `SELECT * FROM wallets WHERE "userId" = $1`,
          [userId],
        );
        return rows.length > 0;
      },
      { timeout: 20000, message: 'Wallet not created after first event' },
    );

    await publishEvent('user.created', userId, {
      id: userId,
      email: 'dup1@test.com',
      phone: '+1111111111',
      fullName: 'Dup Test 1',
    });

    await new Promise((resolve) => setTimeout(resolve, 3000));

    const rows = await dataSource.query(
      `SELECT * FROM wallets WHERE "userId" = $1`,
      [userId],
    );
    expect(rows).toHaveLength(1);
    expect(parseFloat(rows[0].balance)).toBe(0);
  });

  it('should process events for different users independently', async () => {
    const user1Id = 'r2222222-2222-2222-2222-222222222222';
    const user2Id = 'r3333333-3333-3333-3333-333333333333';

    await publishEvent('user.created', user1Id, {
      id: user1Id,
      email: 'indep1@test.com',
      phone: '+1222222222',
      fullName: 'Indep Test 1',
    });

    await publishEvent('user.created', user2Id, {
      id: user2Id,
      email: 'indep2@test.com',
      phone: '+1333333333',
      fullName: 'Indep Test 2',
    });

    await waitUntil(
      async () => {
        const rows = await dataSource.query(
          `SELECT * FROM wallets WHERE "userId" IN ($1, $2)`,
          [user1Id, user2Id],
        );
        return rows.length >= 2;
      },
      { timeout: 20000, message: 'Both wallets not created' },
    );

    await assertWalletCount(dataSource, 2);
  });
});
