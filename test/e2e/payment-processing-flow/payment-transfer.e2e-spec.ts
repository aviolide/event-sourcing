import 'reflect-metadata';
import { DataSource } from 'typeorm';

import { truncateAllPublicTables } from '../../shared/db.helper';
import { createTestJwt } from '../../shared/jwt.helper';
import {
  startTestEnvironment,
  getConfig,
} from '../../shared/containers/test-environment';
import { postJson } from '../../shared/http-e2e.helper';

const JWT_SECRET = 'test-jwt-secret-that-is-at-least-32-characters-long!!';

interface PaymentResponseBody {
  id: string;
  status: string;
  fromUserId: string;
  toUserId: string;
}

describe('Payment Processing Flow E2E', () => {
  let dataSource: DataSource;
  let config: ReturnType<typeof getConfig>;
  let paymentsUrl: string;

  beforeAll(async () => {
    config = await startTestEnvironment(['wallet', 'payments'], true);
    paymentsUrl = config.services.paymentsUrl;

    dataSource = new DataSource({
      type: 'postgres',
      host: config.postgres.host,
      port: config.postgres.port,
      database: config.postgres.database,
      username: config.postgres.username,
      password: config.postgres.password,
    });
    console.log('config', config);
    await dataSource.initialize();
    console.log('data source initialized');
  }, 120000);

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
  }, 60000);

  beforeEach(async () => {
    await truncateAllPublicTables(dataSource);
  });

  it('should create payment when wallet transfer succeeds', async () => {
    const userId = '77777777-7777-4777-8777-777777777777';
    const toUserId = '88888888-8888-4888-8888-888888888888';
    const token = createTestJwt(JWT_SECRET, { sub: userId, email: 'payer@test.com' });

    const dbResult = await dataSource.query(
      `INSERT INTO wallets ("userId", balance, currency) VALUES ($1, $2, $3), ($4, $5, $6)`,
      [userId, '1000.00', 'PEN', toUserId, '0.00', 'PEN'],
    );
    console.log('Database result:', dbResult);


    const response = await postJson<PaymentResponseBody>(
      `${paymentsUrl}/payments/transfer`,
      {
        toUserId,
        amount: 100,
        currency: 'PEN',
        description: 'Test payment',
      },
      token,
    );
    console.log('Payment transfer response:', response);

    expect(response.status).toBe(201);
    expect(response.body.status).toBe('COMPLETED');
    expect(response.body.id).toBeDefined();
    expect(response.body.fromUserId).toBe(userId);
    expect(response.body.toUserId).toBe(toUserId);

    const rows = await dataSource.query(
      `SELECT * FROM payments WHERE "fromUserId" = $1`,
      [userId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('COMPLETED');
  });

  it('should mark payment as FAILED when wallet transfer fails', async () => {
    const userId = '77777777-7777-4777-8777-777777777778';
    const toUserId = '88888888-8888-4888-8888-888888888889';
    const token = createTestJwt(JWT_SECRET, { sub: userId, email: 'payer2@test.com' });

    await dataSource.query(
      `INSERT INTO wallets ("userId", balance, currency) VALUES ($1, $2, $3), ($4, $5, $6)`,
      [userId, '100.00', 'PEN', toUserId, '0.00', 'PEN'],
    );

    const response = await postJson(
      `${paymentsUrl}/payments/transfer`,
      {
        toUserId,
        amount: 9999,
        currency: 'PEN',
      },
      token,
    );

    expect(response.status).toBe(500);

    const rows = await dataSource.query(
      `SELECT * FROM payments WHERE "fromUserId" = $1`,
      [userId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('FAILED');
  });

  it('should reject unauthenticated payment request', async () => {
    const response = await postJson(`${paymentsUrl}/payments/transfer`, {
      toUserId: '88888888-8888-4888-8888-888888888880',
      amount: 100,
      currency: 'PEN',
    });

    expect(response.status).toBe(401);
  });

  it('should reject invalid payment body', async () => {
    const userId = '77777777-7777-4777-8777-777777777779';
    const token = createTestJwt(JWT_SECRET, { sub: userId, email: 'payer3@test.com' });

    const response = await postJson(
      `${paymentsUrl}/payments/transfer`,
      {
        amount: -10,
      },
      token,
    );

    expect(response.status).toBe(400);
  });
});
