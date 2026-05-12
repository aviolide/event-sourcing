import 'reflect-metadata';
import { DataSource } from 'typeorm';

import { truncateAllPublicTables } from '../../shared/db.helper';
import {
  assertNoNegativeBalances,
  assertTotalMoneyConserved,
} from '../../shared/invariants';
import {
  startTestEnvironment,
} from '../../shared/containers/test-environment';
import { postJson } from '../../shared/http-e2e.helper';

describe('Concurrent Transfers Flow E2E', () => {
  let dataSource: DataSource;
  let walletUrl: string;
  let senderId: string;
  let receiverId: string;
  let idSequence = 1;

  beforeAll(async () => {
    const config = await startTestEnvironment(['wallet'], true);
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

    senderId = `55555555-5555-4555-8555-${String(idSequence).padStart(12, '5')}`;
    receiverId = `66666666-6666-4666-8666-${String(idSequence).padStart(12, '6')}`;
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

  it('should handle concurrent transfers without double-spend', async () => {
    const transferAmount = 200;
    const concurrentRequests = 10;

    const promises = Array.from({ length: concurrentRequests }, () =>
      postJson(`${walletUrl}/wallets/transfer`, {
        fromUserId: senderId,
        toUserId: receiverId,
        amount: transferAmount,
        currency: 'PEN',
      })
        .then((res) => ({ status: res.status, body: res.body }))
        .catch(() => ({ status: 500, body: null })),
    );

    const results = await Promise.all(promises);

    const successful = results.filter((r) => r.status === 201);
    const failed = results.filter((r) => r.status !== 201);

    const maxSuccessful = Math.floor(1000 / transferAmount);
    expect(successful.length).toBeLessThanOrEqual(maxSuccessful);
    expect(successful.length).toBeGreaterThan(0);

    await assertNoNegativeBalances(dataSource);
    await assertTotalMoneyConserved(dataSource, 1000);

    const senderWallet = await dataSource.query(
      `SELECT balance FROM wallets WHERE "userId" = $1`,
      [senderId],
    );
    const receiverWallet = await dataSource.query(
      `SELECT balance FROM wallets WHERE "userId" = $1`,
      [receiverId],
    );

    const senderBalance = parseFloat(senderWallet[0].balance);
    const receiverBalance = parseFloat(receiverWallet[0].balance);

    expect(senderBalance).toBeGreaterThanOrEqual(0);
    expect(senderBalance + receiverBalance).toBe(1000);
  });

  it('should handle concurrent withdrawals from a low-balance wallet', async () => {
    await dataSource.query(
      `UPDATE wallets SET balance = $1 WHERE "userId" = $2`,
      ['200.00', senderId],
    );

    const promises = Array.from({ length: 5 }, () =>
      postJson(`${walletUrl}/wallets/transfer`, {
        fromUserId: senderId,
        toUserId: receiverId,
        amount: 150,
        currency: 'PEN',
      })
        .then((res) => ({ status: res.status }))
        .catch(() => ({ status: 500 })),
    );

    const results = await Promise.all(promises);
    const successful = results.filter((r) => r.status === 201);

    expect(successful.length).toBeLessThanOrEqual(1);

    await assertNoNegativeBalances(dataSource);
    await assertTotalMoneyConserved(dataSource, 200);
  });
});
