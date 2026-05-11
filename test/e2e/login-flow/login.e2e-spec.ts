import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';

import { createTestApp } from '../../shared/app.factory';
import { truncateAll } from '../../shared/db.helper';
import {
  startTestEnvironment,
  stopTestEnvironment,
  getConfig,
} from '../../shared/containers/test-environment';
import { disconnectKafka, ensureKafkaTopics } from '../../shared/kafka.helper';
import { UserBuilder } from '../../shared/builders/user.builder';

describe('Login Flow E2E', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    const config = await startTestEnvironment();

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

  async function registerUser(overrides = {}) {
    const user = UserBuilder.aUser().build();
    const body = { ...user, ...overrides };

    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send(body);

    return { ...res.body, password: body.password };
  }

  it('should login with valid credentials', async () => {
    const user = await registerUser();

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        identifier: user.user.email,
        password: user.password,
      });

    expect(response.status).toBe(201);
    expect(response.body.tokens.accessToken).toBeDefined();
    expect(response.body.tokens.refreshToken).toBeDefined();
    expect(response.body.user.email).toBe(user.user.email);
  });

  it('should reject login with wrong password', async () => {
    const user = await registerUser();

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        identifier: user.user.email,
        password: 'WrongPassword123',
      });

    expect(response.status).toBe(401);
  });

  it('should reject login with nonexistent email', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        identifier: 'nonexistent@test.com',
        password: 'Password123',
      });

    expect(response.status).toBe(401);
  });

  it('should reject login with invalid body', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({});

    expect(response.status).toBe(400);
  });
});
