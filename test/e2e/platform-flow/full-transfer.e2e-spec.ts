import 'reflect-metadata';
import { DataSource } from 'typeorm';

import { truncateAllPublicTables } from '../../shared/db.helper';
import { assertNoNegativeBalances } from '../../shared/invariants';
import { waitUntil } from '../../shared/wait-until';
import {
  getConfig,
  startTestEnvironment,
} from '../../shared/containers/test-environment';
import { postGraphql, requestOk } from '../../shared/http-e2e.helper';

interface UserRow {
  id: string;
  email: string;
}

async function waitForUrl(url: string, timeout = 30000): Promise<void> {
  await waitUntil(
    async () => {
      return requestOk(url);
    },
    { timeout, interval: 500, message: `${url} not ready` },
  );
}

describe('Platform Full Transfer Flow E2E', () => {
  let config: ReturnType<typeof getConfig>;
  let dataSource: DataSource;
  let gatewayUrl: string;

  beforeAll(async () => {
    config = await startTestEnvironment(['auth', 'wallet', 'payments', 'gateway']);

    dataSource = new DataSource({
      type: 'postgres',
      host: config.postgres.host,
      port: config.postgres.port,
      database: config.postgres.database,
      username: config.postgres.username,
      password: config.postgres.password,
      synchronize: true,
      logging: false,
    });
    await dataSource.initialize();

    await truncateAllPublicTables(dataSource);
    gatewayUrl = `${config.services.gatewayUrl}/graphql`;
    await waitForUrl(gatewayUrl);
  }, 180000);

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
  }, 60000);

  beforeEach(async () => {
    await truncateAllPublicTables(dataSource);
  });

  it('should execute full register → login → transfer → verify flow', async () => {
    const aliceEmail = `alice-platform-${Date.now()}@test.com`;
    const bobEmail = `bob-platform-${Date.now()}@test.com`;

    const aliceResult = await postGraphql<{
      data: { register: { accessToken: string } };
      errors?: unknown[];
    }>(
      gatewayUrl,
      `
          mutation Register($input: RegisterInput!) {
            register(input: $input) {
              accessToken
              refreshToken
            }
          }
        `,
      {
        input: {
          fullName: 'Alice Platform',
          email: aliceEmail,
          phone: '+1111111111',
          password: 'Password123',
        },
      },
    );

    expect(aliceResult.errors).toBeUndefined();
    const aliceToken = aliceResult.data.register.accessToken;
    expect(aliceToken).toBeDefined();

    const bobResult = await postGraphql<{
      data: { register: { accessToken: string } };
      errors?: unknown[];
    }>(
      gatewayUrl,
      `
          mutation Register($input: RegisterInput!) {
            register(input: $input) {
              accessToken
              refreshToken
            }
          }
        `,
      {
        input: {
          fullName: 'Bob Platform',
          email: bobEmail,
          phone: '+2222222222',
          password: 'Password123',
        },
      },
    );

    expect(bobResult.errors).toBeUndefined();
    const bobToken = bobResult.data.register.accessToken;
    expect(bobToken).toBeDefined();

    await waitUntil(
      async () => {
        const rows = await dataSource.query(
          `SELECT COUNT(*) as count FROM wallets`,
        );
        return parseInt(rows[0].count, 10) >= 2;
      },
      { timeout: 20000, message: 'Wallets not created by Kafka consumer' },
    );

    const users: UserRow[] = await dataSource.query(
      `SELECT id, email FROM users WHERE email IN ($1, $2)`,
      [aliceEmail, bobEmail],
    );
    expect(users).toHaveLength(2);

    const bobId = users.find((user) => user.email === bobEmail)?.id;
    expect(bobId).toBeDefined();

    const transfer = await postGraphql<{
      data: { transfer: { status: string } };
      errors?: unknown[];
    }>(
      gatewayUrl,
      `
          mutation Transfer($input: TransferInput!) {
            transfer(input: $input) {
              id
              status
              description
            }
          }
        `,
      {
        input: {
          toUserId: bobId,
          amount: 100,
          currency: 'PEN',
          description: 'Platform test transfer',
        },
      },
      aliceToken,
    );

    expect(transfer.errors).toBeUndefined();
    expect(transfer.data.transfer.status).toBe('COMPLETED');

    await assertNoNegativeBalances(dataSource);
  }, 60000);
});
