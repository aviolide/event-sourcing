import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { createTestApp } from '../../shared/app.factory';
import { truncateAll } from '../../shared/db.helper';
import { assertWalletCount } from '../../shared/invariants';
import {
  createKafkaProducer,
  publishEvent,
  disconnectKafka,
  ensureKafkaTopics,
} from '../../shared/kafka.helper';
import { waitUntil } from '../../shared/wait-until';
import {
  startTestEnvironment,
  getConfig,
} from '../../shared/containers/test-environment';

describe('Kafka Reliability Flow E2E', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let config: ReturnType<typeof getConfig>;
  let userSequence = 1;

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

    await ensureKafkaTopics(config.kafka.broker, ['user.created']);

    const { AppModule } = await import('../../../02-wallet/src/app.module');

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
  }, 60000);

  beforeEach(async () => {
    await truncateAll(dataSource);
  });

  it('should handle duplicate user.created events idempotently', async () => {
    const userId = `11111111-1111-4111-8111-${String(userSequence).padStart(12, '1')}`;
    userSequence += 1;

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

    let rows: Array<{ balance: string }> = [];
    await waitUntil(
      async () => {
        rows = await dataSource.query(
          `SELECT * FROM wallets WHERE "userId" = $1`,
          [userId],
        );
        return rows.length === 1;
      },
      { timeout: 5000, message: 'Duplicate user.created created extra wallets' },
    );

    expect(rows).toHaveLength(1);
    expect(parseFloat(rows[0].balance)).toBe(0);
  });

  it('should process events for different users independently', async () => {
    const user1Id = `22222222-2222-4222-8222-${String(userSequence).padStart(12, '2')}`;
    userSequence += 1;
    const user2Id = `33333333-3333-4333-8333-${String(userSequence).padStart(12, '3')}`;
    userSequence += 1;

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

    const rows = await dataSource.query(
      `SELECT * FROM wallets WHERE "userId" IN ($1, $2)`,
      [user1Id, user2Id],
    );
    expect(rows).toHaveLength(2);
  });
});
