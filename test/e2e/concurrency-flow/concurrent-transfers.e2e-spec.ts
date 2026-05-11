import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';

import { createTestApp } from '../../shared/app.factory';
import { truncateAll } from '../../shared/db.helper';
import {
  assertNoNegativeBalances,
  assertTotalMoneyConserved,
} from '../../shared/invariants';
import {
  startTestEnvironment,
  getConfig,
} from '../../shared/containers/test-environment';
import { disconnectKafka, ensureKafkaTopics } from '../../shared/kafka.helper';

describe('Concurrent Transfers Flow E2E', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let senderId: string;
  let receiverId: string;
  let idSequence = 1;

  beforeAll(async () => {
    const config = await startTestEnvironment();

    Object.assign(process.env, {
      PORT: '3022',
      SERVICE_NAME: 'wallet-concurrency-test',
      DB_HOST: config.postgres.host,
      DB_PORT: String(config.postgres.port),
      DB_NAME: config.postgres.database,
      DB_USERNAME: config.postgres.username,
      DB_PASSWORD: config.postgres.password,
      KAFKA_BROKER: config.kafka.broker,
      KAFKA_CLIENT_ID: 'wallet-conc-test-client',
      KAFKA_GROUP_ID: 'wallet-conc-test-group',
      NODE_ENV: 'test',
    });

    await ensureKafkaTopics(config.kafka.broker, ['user.created']);

    const { AppModule } = await import('../../../02-wallet/src/app.module');

    app = await createTestApp({
      imports: [AppModule],
      connectMicroservice: {
        broker: config.kafka.broker,
        groupId: 'wallet-conc-test-group',
        clientId: 'wallet-conc-test-client',
      },
    });

    dataSource = app.get(DataSource);
  }, 120000);

  afterAll(async () => {
    if (app) await app.close();
    await disconnectKafka();
  }, 60000);

  beforeEach(async () => {
    await truncateAll(dataSource);

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
      request(app.getHttpServer())
        .post('/wallets/transfer')
        .send({
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
      request(app.getHttpServer())
        .post('/wallets/transfer')
        .send({
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
