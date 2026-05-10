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
import { disconnectKafka } from '../../shared/kafka.helper';
import { UserBuilder } from '../../shared/builders/user.builder';

import { AppModule } from '../../../01-auth/src/app.module';

describe('Token Refresh Flow E2E', () => {
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

  async function registerAndGetTokens() {
    const user = UserBuilder.aUser().build();
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send(user);

    return {
      user,
      accessToken: res.body.tokens.accessToken,
      refreshToken: res.body.tokens.refreshToken,
      userId: res.body.user.id,
    };
  }

  it('should refresh tokens with valid refresh token', async () => {
    const { accessToken, refreshToken, userId } =
      await registerAndGetTokens();

    const response = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ refreshToken });

    expect(response.status).toBe(201);
    expect(response.body.tokens.accessToken).toBeDefined();
    expect(response.body.tokens.refreshToken).toBeDefined();
    expect(response.body.tokens.accessToken).not.toBe(accessToken);
    expect(response.body.tokens.refreshToken).not.toBe(refreshToken);
  });

  it('should reject reused refresh token', async () => {
    const { accessToken, refreshToken } = await registerAndGetTokens();

    const firstRefresh = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ refreshToken });

    expect(firstRefresh.status).toBe(201);
    const newAccessToken = firstRefresh.body.tokens.accessToken;

    const secondRefresh = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Authorization', `Bearer ${newAccessToken}`)
      .send({ refreshToken });

    expect(secondRefresh.status).toBe(401);
  });

  it('should reject refresh without auth header', async () => {
    const { refreshToken } = await registerAndGetTokens();

    const response = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken });

    expect(response.status).toBe(401);
  });
});
