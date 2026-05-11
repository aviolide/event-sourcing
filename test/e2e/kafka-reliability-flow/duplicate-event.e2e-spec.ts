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

describe('Kafka Reliability Flow E2E', () => {
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
