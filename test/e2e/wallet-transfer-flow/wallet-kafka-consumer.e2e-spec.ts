import 'reflect-metadata';
import { DataSource } from 'typeorm';

import { truncateAllPublicTables } from '../../shared/db.helper';
import {
  createKafkaProducer,
  publishEvent,
  disconnectKafka,
} from '../../shared/kafka.helper';
import { waitUntil } from '../../shared/wait-until';
import {
  startTestEnvironment,
  getConfig,
} from '../../shared/containers/test-environment';

describe('Wallet Kafka Consumer Flow E2E', () => {
  let dataSource: DataSource;
  let config: ReturnType<typeof getConfig>;
  let userSequence = 1;

  beforeAll(async () => {
    config = await startTestEnvironment(['wallet']);

    dataSource = new DataSource({
      type: 'postgres',
      host: config.postgres.host,
      port: config.postgres.port,
      database: config.postgres.database,
      username: config.postgres.username,
      password: config.postgres.password,
    });
    await dataSource.initialize();

    await createKafkaProducer(config.kafka.broker);
  }, 120000);

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
    await disconnectKafka();
  }, 60000);

  beforeEach(async () => {
    await truncateAllPublicTables(dataSource);
  });

  it('should create wallet when user.created event is received', async () => {
    const userId = `33333333-3333-4333-8333-${String(userSequence).padStart(12, '3')}`;
    userSequence += 1;

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
    const userId = `44444444-4444-4444-8444-${String(userSequence).padStart(12, '4')}`;
    userSequence += 1;

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

    await waitUntil(
      async () => {
        const result = await dataSource.query(
          `SELECT COUNT(*) as count FROM wallets`,
        );
        return parseInt(result[0].count, 10) === 1;
      },
      { timeout: 5000, message: 'Duplicate user.created changed wallet count' },
    );

    const rows = await dataSource.query(
      `SELECT * FROM wallets WHERE "userId" = $1`,
      [userId],
    );
    expect(rows).toHaveLength(1);
    expect(parseFloat(rows[0].balance)).toBe(0);
  });
});
