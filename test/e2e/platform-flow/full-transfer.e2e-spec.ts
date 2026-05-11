import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ChildProcess, spawn } from 'child_process';

import { truncateAllPublicTables } from '../../shared/db.helper';
import { assertNoNegativeBalances } from '../../shared/invariants';
import { waitUntil } from '../../shared/wait-until';
import {
  startTestEnvironment,
  getConfig,
} from '../../shared/containers/test-environment';

const JWT_SECRET = 'test-jwt-secret-that-is-at-least-32-characters-long!!';

function spawnService(
  serviceDir: string,
  env: Record<string, string>,
): ChildProcess {
  const proc = spawn(
    process.execPath,
    [
      '-r',
      'tsconfig-paths/register',
      '-r',
      'ts-node/register',
      `${serviceDir}/src/main.ts`,
    ],
    {
      cwd: process.cwd(),
      env: { ...process.env, ...env },
      stdio: 'pipe',
    },
  );

  proc.stdout?.on('data', (data: Buffer) => {
    Logger.log(`[${serviceDir}] ${data.toString().trim()}`);
  });

  proc.stderr?.on('data', (data: Buffer) => {
    Logger.error(`[${serviceDir}] ${data.toString().trim()}`);
  });

  return proc;
}

async function waitForUrl(url: string, timeout = 30000): Promise<void> {
  await waitUntil(
    async () => {
      try {
        await fetch(url);
        return true;
      } catch {
        return false;
      }
    },
    { timeout, interval: 500, message: `${url} not ready` },
  );
}

describe('Platform Full Transfer Flow E2E', () => {
  let config: ReturnType<typeof getConfig>;
  let authProc: ChildProcess;
  let walletProc: ChildProcess;
  let paymentsProc: ChildProcess;
  let gatewayProc: ChildProcess;
  let dataSource: DataSource;
  let gatewayUrl: string;

  beforeAll(async () => {
    config = await startTestEnvironment();

    const { DataSource: DS } = await import('typeorm');
    dataSource = new DS({
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

    if (config.mode === 'external') {
      gatewayUrl = `${config.services.gatewayUrl}/graphql`;
      await waitForUrl(gatewayUrl);
      return;
    }

    const baseDbEnv = {
      DB_HOST: config.postgres.host,
      DB_PORT: String(config.postgres.port),
      DB_NAME: config.postgres.database,
      DB_USERNAME: config.postgres.username,
      DB_PASSWORD: config.postgres.password,
      KAFKA_BROKER: config.kafka.broker,
    };

    authProc = spawnService('01-auth', {
      ...baseDbEnv,
      PORT: '30110',
      KAFKA_CLIENT_ID: 'auth-platform-client',
      JWT_SECRET: JWT_SECRET,
      JWT_EXPIRES_IN: '15m',
      JWT_REFRESH_SECRET: 'test-refresh-secret-that-is-at-least-32-chars!!',
      JWT_REFRESH_EXPIRES_IN: '7d',
    });

    await waitForUrl('http://localhost:30110/');

    walletProc = spawnService('02-wallet', {
      ...baseDbEnv,
      PORT: '30220',
      SERVICE_NAME: 'wallet-platform-service',
      KAFKA_CLIENT_ID: 'wallet-platform-client',
      KAFKA_GROUP_ID: 'wallet-platform-group',
      NODE_ENV: 'test',
    });

    await waitForUrl('http://localhost:30220/');

    paymentsProc = spawnService('03-payments', {
      ...baseDbEnv,
      PORT: '30330',
      KAFKA_CLIENT_ID: 'payments-platform-client',
      KAFKA_GROUP_ID: 'payments-platform-group',
      JWT_SECRET: JWT_SECRET,
      WALLET_SERVICE_URL: 'http://localhost:30220',
    });

    await waitForUrl('http://localhost:30330/');

    gatewayProc = spawnService('00-gateway', {
      NODE_ENV: 'test',
      PORT: '30000',
      AUTH_SERVICE_URL: 'http://localhost:30110',
      WALLET_SERVICE_URL: 'http://localhost:30220',
      PAYMENTS_SERVICE_URL: 'http://localhost:30330',
      JWT_SECRET: JWT_SECRET,
      CORS_ORIGINS: '',
      RATE_LIMIT_WINDOW_MS: '60000',
      RATE_LIMIT_MAX: '1200',
    });

    gatewayUrl = 'http://localhost:30000/graphql';
    await waitForUrl(gatewayUrl);
  }, 180000);

  afterAll(async () => {
    const kill = (proc: ChildProcess) => {
      try { proc.kill('SIGTERM'); } catch {}
    };

    if (gatewayProc) kill(gatewayProc);
    if (paymentsProc) kill(paymentsProc);
    if (walletProc) kill(walletProc);
    if (authProc) kill(authProc);

    if (dataSource?.isInitialized) await dataSource.destroy();
  }, 60000);

  beforeEach(async () => {
    await truncateAllPublicTables(dataSource);
  });

  it('should execute full register → login → transfer → verify flow', async () => {
    const aliceEmail = `alice-platform-${Date.now()}@test.com`;
    const bobEmail = `bob-platform-${Date.now()}@test.com`;

    const aliceRegister = await fetch(gatewayUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation Register($input: RegisterInput!) {
            register(input: $input) {
              accessToken
              refreshToken
            }
          }
        `,
        variables: {
          input: {
            fullName: 'Alice Platform',
            email: aliceEmail,
            phone: '+1111111111',
            password: 'Password123',
          },
        },
      }),
    });

    const aliceResult = await aliceRegister.json();
    expect(aliceResult.errors).toBeUndefined();
    const aliceToken = aliceResult.data.register.accessToken;
    expect(aliceToken).toBeDefined();

    const bobRegister = await fetch(gatewayUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation Register($input: RegisterInput!) {
            register(input: $input) {
              accessToken
              refreshToken
            }
          }
        `,
        variables: {
          input: {
            fullName: 'Bob Platform',
            email: bobEmail,
            phone: '+2222222222',
            password: 'Password123',
          },
        },
      }),
    });

    const bobResult = await bobRegister.json();
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

    const users = await dataSource.query(
      `SELECT id, email FROM users WHERE email IN ($1, $2)`,
      [aliceEmail, bobEmail],
    );
    expect(users).toHaveLength(2);

    const bobId = users.find((u: any) => u.email === bobEmail)?.id;
    expect(bobId).toBeDefined();

    const transferResult = await fetch(gatewayUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aliceToken}`,
      },
      body: JSON.stringify({
        query: `
          mutation Transfer($input: TransferInput!) {
            transfer(input: $input) {
              id
              status
              description
            }
          }
        `,
        variables: {
          input: {
            toUserId: bobId,
            amount: 100,
            currency: 'PEN',
            description: 'Platform test transfer',
          },
        },
      }),
    });

    const transfer = await transferResult.json();
    expect(transfer.errors).toBeUndefined();
    expect(transfer.data.transfer.status).toBe('COMPLETED');

    await assertNoNegativeBalances(dataSource);
  }, 60000);
});
