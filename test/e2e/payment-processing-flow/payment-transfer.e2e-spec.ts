import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';

import { createTestApp } from '../../shared/app.factory';
import { truncateAll } from '../../shared/db.helper';
import { createTestJwt } from '../../shared/jwt.helper';
import { waitForKafkaMessage, disconnectKafka } from '../../shared/kafka.helper';
import { startTestEnvironment, stopTestEnvironment, getConfig } from '../../shared/containers/test-environment';
import { HttpServiceMock } from '../../shared/mocks/http-service.mock';
import { UserBuilder } from '../../shared/builders/user.builder';

import { AppModule } from '../../../03-payments/src/app.module';
import { HttpService } from '../../../03-payments/node_modules/@nestjs/axios';

const JWT_SECRET = 'test-jwt-secret-that-is-at-least-32-characters-long!!';

describe('Payment Processing Flow E2E', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let httpMock: HttpServiceMock;
  let config: ReturnType<typeof getConfig>;

  beforeAll(async () => {
    config = await startTestEnvironment();

    Object.assign(process.env, {
      PORT: '3030',
      DB_HOST: config.postgres.host,
      DB_PORT: String(config.postgres.port),
      DB_NAME: config.postgres.database,
      DB_USERNAME: config.postgres.username,
      DB_PASSWORD: config.postgres.password,
      KAFKA_BROKER: config.kafka.broker,
      KAFKA_CLIENT_ID: 'payments-test-client',
      KAFKA_GROUP_ID: 'payments-test-group',
      JWT_SECRET: JWT_SECRET,
      WALLET_SERVICE_URL: 'http://localhost:3020',
    });

    httpMock = new HttpServiceMock();

    app = await createTestApp({
      imports: [AppModule],
      overrides: [{ provide: HttpService, useValue: httpMock }],
      connectMicroservice: {
        broker: config.kafka.broker,
        groupId: 'payments-test-group',
        clientId: 'payments-test-client',
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
    httpMock.setPostResponse({});
  });

  it('should create payment when wallet transfer succeeds', async () => {
    const userId = 'p7777777-7777-7777-7777-777777777777';
    const toUserId = 'q8888888-8888-8888-8888-888888888888';
    const token = createTestJwt(JWT_SECRET, { sub: userId, email: 'payer@test.com' });

    httpMock.setPostResponse({ from: { balance: '900' }, to: { balance: '100' } });

    const response = await request(app.getHttpServer())
      .post('/payments/transfer')
      .set('Authorization', `Bearer ${token}`)
      .send({
        toUserId,
        amount: 100,
        currency: 'PEN',
        description: 'Test payment',
      });

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
    const userId = 'p7777777-7777-7777-7777-777777777778';
    const toUserId = 'q8888888-8888-8888-8888-888888888889';
    const token = createTestJwt(JWT_SECRET, { sub: userId, email: 'payer2@test.com' });

    httpMock.setPostError({
      response: { data: { message: 'Insufficient funds' } },
      message: 'Request failed with status code 400',
    });

    const response = await request(app.getHttpServer())
      .post('/payments/transfer')
      .set('Authorization', `Bearer ${token}`)
      .send({
        toUserId,
        amount: 9999,
        currency: 'PEN',
      });

    expect(response.status).toBe(500);

    const rows = await dataSource.query(
      `SELECT * FROM payments WHERE "fromUserId" = $1`,
      [userId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('FAILED');
  });

  it('should reject unauthenticated payment request', async () => {
    const response = await request(app.getHttpServer())
      .post('/payments/transfer')
      .send({
        toUserId: 'q8888888-8888-8888-8888-888888888880',
        amount: 100,
        currency: 'PEN',
      });

    expect(response.status).toBe(401);
  });

  it('should reject invalid payment body', async () => {
    const userId = 'p7777777-7777-7777-7777-777777777779';
    const token = createTestJwt(JWT_SECRET, { sub: userId, email: 'payer3@test.com' });

    const response = await request(app.getHttpServer())
      .post('/payments/transfer')
      .set('Authorization', `Bearer ${token}`)
      .send({
        amount: -10,
      });

    expect(response.status).toBe(400);
  });
});
