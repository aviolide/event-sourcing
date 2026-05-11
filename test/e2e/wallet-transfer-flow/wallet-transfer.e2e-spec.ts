import 'reflect-metadata';
import { DataSource } from 'typeorm';

import { truncateAllPublicTables } from '../../shared/db.helper';
import {
  assertNoNegativeBalances,
  assertTotalMoneyConserved,
} from '../../shared/invariants';
import { startTestEnvironment } from '../../shared/containers/test-environment';
import { getJson, postJson } from '../../shared/http-e2e.helper';

interface WalletResponseBody {
  userId: string;
  balance: string;
  currency: string;
}

interface WalletTransferResponseBody {
  from: { balance: string };
  to: { balance: string };
}

describe('Wallet Transfer Flow E2E', () => {
  let dataSource: DataSource;
  let walletUrl: string;
  let senderId: string;
  let receiverId: string;
  let idSequence = 1;

  beforeAll(async () => {
    const config = await startTestEnvironment(['wallet']);
    walletUrl = config.services.walletUrl;

    dataSource = new DataSource({
      type: 'postgres',
      host: config.postgres.host,
      port: config.postgres.port,
      database: config.postgres.database,
      username: config.postgres.username,
      password: config.postgres.password,
    });
    await dataSource.initialize();
  }, 120000);

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
  }, 60000);

  beforeEach(async () => {
    await truncateAllPublicTables(dataSource);

    senderId = `11111111-1111-4111-8111-${String(idSequence).padStart(12, '1')}`;
    receiverId = `22222222-2222-4222-8222-${String(idSequence).padStart(12, '2')}`;
    idSequence += 1;

    await dataSource.query(
      `INSERT INTO wallets ("userId", balance, currency) VALUES ($1, $2, $3)`,
      [senderId, '1000.00', 'PEN'],
    );
    await dataSource.query(
      `INSERT INTO wallets ("userId", balance, currency) VALUES ($1, $2, $3)`,
      [receiverId, '0.00', 'PEN'],
    );
  });

  it('should get wallet by userId', async () => {
    const response = await getJson<WalletResponseBody>(
      `${walletUrl}/wallets/${senderId}`,
    );

    expect(response.status).toBe(200);
    expect(response.body.userId).toBe(senderId);
    expect(parseFloat(response.body.balance)).toBe(1000);
    expect(response.body.currency).toBe('PEN');
  });

  it('should return 404 for nonexistent wallet', async () => {
    const response = await getJson(
      `${walletUrl}/wallets/99999999-9999-9999-9999-999999999999`,
    );

    expect(response.status).toBe(404);
  });

  it('should transfer money between wallets', async () => {
    const response = await postJson<WalletTransferResponseBody>(
      `${walletUrl}/wallets/transfer`,
      {
        fromUserId: senderId,
        toUserId: receiverId,
        amount: 100,
        currency: 'PEN',
      },
    );

    expect(response.status).toBe(201);
    expect(parseFloat(response.body.from.balance)).toBe(900);
    expect(parseFloat(response.body.to.balance)).toBe(100);

    await assertNoNegativeBalances(dataSource);
    await assertTotalMoneyConserved(dataSource, 1000);
  });

  it('should reject transfer with insufficient funds', async () => {
    const response = await postJson(`${walletUrl}/wallets/transfer`, {
      fromUserId: senderId,
      toUserId: receiverId,
      amount: 9999,
      currency: 'PEN',
    });

    expect(response.status).toBe(400);

    await assertNoNegativeBalances(dataSource);
    await assertTotalMoneyConserved(dataSource, 1000);
  });

  it('should reject transfer to nonexistent wallet', async () => {
    const response = await postJson(`${walletUrl}/wallets/transfer`, {
      fromUserId: senderId,
      toUserId: '99999999-9999-4999-9999-999999999999',
      amount: 100,
      currency: 'PEN',
    });

    expect(response.status).toBe(404);
  });

  it('should reject transfer to self', async () => {
    const response = await postJson(`${walletUrl}/wallets/transfer`, {
      fromUserId: senderId,
      toUserId: senderId,
      amount: 100,
      currency: 'PEN',
    });

    expect(response.status).toBe(400);
  });

  it('should reject transfer with invalid body', async () => {
    const response = await postJson(`${walletUrl}/wallets/transfer`, {
      fromUserId: senderId,
      toUserId: receiverId,
    });

    expect(response.status).toBe(400);
  });
});
