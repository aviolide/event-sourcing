import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';

import { createTestApp } from '../../shared/app.factory';
import { truncateAll } from '../../shared/db.helper';
import { assertUniqueEmails } from '../../shared/invariants';
import { disconnectKafka, ensureKafkaTopics } from '../../shared/kafka.helper';
import {
  startTestEnvironment,
  stopTestEnvironment,
  getConfig,
} from '../../shared/containers/test-environment';
import { UserBuilder } from '../../shared/builders/user.builder';

describe('User Registration Flow E2E', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let config: ReturnType<typeof getConfig>;

  beforeAll(async () => {
    config = await startTestEnvironment();

    Object.assign(process.env, {
      PORT: '3010',
      DB_HOST: config.postgres.host,
      DB_PORT: String(config.postgres.port),
      DB_NAME: config.postgres.database,
      DB_USERNAME: config.postgres.username,
      DB_PASSWORD: config.postgres.password,
      KAFKA_BROKER: config.kafka.broker,
      KAFKA_CLIENT_ID: 'auth-test-client',
      JWT_SECRET: 'test-jwt-secret-that-is-at-least-32-characters-long!!',
      JWT_EXPIRES_IN: '15m',
      JWT_REFRESH_SECRET: 'test-refresh-secret-that-is-at-least-32-chars!!',
      JWT_REFRESH_EXPIRES_IN: '7d',
    });

    await ensureKafkaTopics(config.kafka.broker, ['user.created']);

    const { AppModule } = await import('../../../01-auth/src/app.module');
    app = await createTestApp({ imports: [AppModule] });
    dataSource = app.get(DataSource);
  }, 120000);

  afterAll(async () => {
    if (app) await app.close();
    await disconnectKafka();
    await stopTestEnvironment();
  }, 60000);

  beforeEach(async () => {
    await truncateAll(dataSource);
  });

  it('should register a new user and return tokens', async () => {
    const user = UserBuilder.aUser().build();

    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send(user);

    expect(response.status).toBe(201);
    expect(response.body.user).toBeDefined();
    expect(response.body.user.email).toBe(user.email);
    expect(response.body.user.fullName).toBe(user.fullName);
    expect(response.body.tokens.accessToken).toBeDefined();
    expect(response.body.tokens.refreshToken).toBeDefined();
  });

  it('should emit user.created Kafka event after registration', async () => {
    const user = UserBuilder.aUser().build();
    const producer = app.get('AUTH_KAFKA_CLIENT');
    const dispatchSpy = jest.spyOn(producer, 'dispatchEvent');
    dispatchSpy.mockClear();

    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send(user);

    expect(response.status).toBe(201);
    const userId = response.body.user.id;

    const packet = dispatchSpy.mock.calls.find(
      ([call]: [{ data?: { email?: string }; pattern?: string }]) =>
        call.pattern === 'user.created' && call.data?.email === user.email,
    )?.[0] as { data?: unknown } | undefined;

    expect(packet).toBeDefined();
    expect(packet.data).toMatchObject({
      id: userId,
      email: user.email,
      fullName: user.fullName,
    });
  });

  it('should reject duplicate email registration', async () => {
    const user = UserBuilder.aUser().build();

    await request(app.getHttpServer()).post('/auth/register').send(user);

    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send(user);

    expect(response.status).toBe(500);
  });

  it('should reject invalid registration body', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        fullName: 'A',
        password: 'short',
      });

    expect(response.status).toBe(400);
  });

  it('should persist user in database with unique email', async () => {
    const user = UserBuilder.aUser().build();

    await request(app.getHttpServer()).post('/auth/register').send(user);

    await assertUniqueEmails(dataSource);

    const rows = await dataSource.query(
      `SELECT * FROM users WHERE email = $1`,
      [user.email],
    );
    expect(rows).toHaveLength(1);
  });
});
