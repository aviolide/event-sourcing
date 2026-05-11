import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';

import { createTestApp } from '../../shared/app.factory';
import { truncateAll } from '../../shared/db.helper';
import { assertNoNegativeBalances, assertTotalMoneyConserved } from '../../shared/invariants';
import { startTestEnvironment, stopTestEnvironment, getConfig } from '../../shared/containers/test-environment';
import { disconnectKafka, ensureKafkaTopics } from '../../shared/kafka.helper';

describe('Wallet Transfer Flow E2E', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let senderId: string;
  let receiverId: string;
  let idSequence = 1;

  beforeAll(async () => {
    const config = await startTestEnvironment();

    Object.assign(process.env, {
      PORT: '3020',
      SERVICE_NAME: 'wallet-test-service',
      DB_HOST: config.postgres.host,
      DB_PORT: String(config.postgres.port),
      DB_NAME: config.postgres.database,
      DB_USERNAME: config.postgres.username,
      DB_PASSWORD: config.postgres.password,
      KAFKA_BROKER: config.kafka.broker,
      KAFKA_CLIENT_ID: 'wallet-test-client',
      KAFKA_GROUP_ID: 'wallet-test-group',
      NODE_ENV: 'test',
    });

    await ensureKafkaTopics(config.kafka.broker, ['user.created']);

    const { AppModule } = await import('../../../02-wallet/src/app.module');

    app = await createTestApp({
      imports: [AppModule],
      connectMicroservice: {
        broker: config.kafka.broker,
        groupId: 'wallet-test-group',
        clientId: 'wallet-test-client',
      },
    });

    dataSource = app.get(DataSource);
  }, 120000);

  afterAll(async () => {
    if (app) await app.close();
    await disconnectKafka();
    await stopTestEnvironment();
  }, 60000);

  beforeEach(async () => {
    await truncateAll(dataSource);

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
    const response = await request(app.getHttpServer()).get(
      `/wallets/${senderId}`,
    );

    expect(response.status).toBe(200);
    expect(response.body.userId).toBe(senderId);
    expect(parseFloat(response.body.balance)).toBe(1000);
    expect(response.body.currency).toBe('PEN');
  });

  it('should return 404 for nonexistent wallet', async () => {
    const response = await request(app.getHttpServer()).get(
      `/wallets/99999999-9999-9999-9999-999999999999`,
    );

    expect(response.status).toBe(404);
  });

  it('should transfer money between wallets', async () => {
    const response = await request(app.getHttpServer())
      .post('/wallets/transfer')
      .send({
        fromUserId: senderId,
        toUserId: receiverId,
        amount: 100,
        currency: 'PEN',
      });

    expect(response.status).toBe(201);
    expect(parseFloat(response.body.from.balance)).toBe(900);
    expect(parseFloat(response.body.to.balance)).toBe(100);

    await assertNoNegativeBalances(dataSource);
    await assertTotalMoneyConserved(dataSource, 1000);
  });

  it('should reject transfer with insufficient funds', async () => {
    const response = await request(app.getHttpServer())
      .post('/wallets/transfer')
      .send({
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
    const response = await request(app.getHttpServer())
      .post('/wallets/transfer')
      .send({
        fromUserId: senderId,
        toUserId: '99999999-9999-4999-9999-999999999999',
        amount: 100,
        currency: 'PEN',
      });

    expect(response.status).toBe(404);
  });

  it('should reject transfer to self', async () => {
    const response = await request(app.getHttpServer())
      .post('/wallets/transfer')
      .send({
        fromUserId: senderId,
        toUserId: senderId,
        amount: 100,
        currency: 'PEN',
      });

    expect(response.status).toBe(400);
  });

  it('should reject transfer with invalid body', async () => {
    const response = await request(app.getHttpServer())
      .post('/wallets/transfer')
      .send({
        fromUserId: senderId,
        toUserId: receiverId,
      });

    expect(response.status).toBe(400);
  });
});
