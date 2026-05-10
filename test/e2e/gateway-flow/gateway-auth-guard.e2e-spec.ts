import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { createTestApp } from '../../shared/app.factory';
import { graphqlRequest } from '../../shared/graphql.helper';
import { startTestEnvironment, stopTestEnvironment, getConfig } from '../../shared/containers/test-environment';
import { UserBuilder } from '../../shared/builders/user.builder';

import { AppModule } from '../../../00-gateway/src/app.module';

describe('Gateway Auth Guard Flow E2E', () => {
  let app: INestApplication;
  let config: ReturnType<typeof getConfig>;

  beforeAll(async () => {
    config = await startTestEnvironment();

    Object.assign(process.env, {
      NODE_ENV: 'test',
      PORT: '3000',
      AUTH_SERVICE_URL: 'http://localhost:3010',
      WALLET_SERVICE_URL: 'http://localhost:3020',
      PAYMENTS_SERVICE_URL: 'http://localhost:3030',
      JWT_SECRET: 'test-jwt-secret-that-is-at-least-32-characters-long!!',
      CORS_ORIGINS: '',
      RATE_LIMIT_WINDOW_MS: '60000',
      RATE_LIMIT_MAX: '120',
    });

    app = await createTestApp({ imports: [AppModule] });
  }, 120000);

  afterAll(async () => {
    if (app) await app.close();
    await stopTestEnvironment();
  }, 60000);

  it('should reject unauthenticated wallet query', async () => {
    const response = await graphqlRequest(app, `
      query {
        wallet(userId: "some-user-id") {
          id
          balance
        }
      }
    `);

    expect(response.errors).toBeDefined();
  });

  it('should reject unauthenticated transfer mutation', async () => {
    const response = await graphqlRequest(app, `
      mutation {
        transfer(input: {
          toUserId: "some-user-id",
          amount: 100,
          currency: "PEN"
        }) {
          id
          status
        }
      }
    `);

    expect(response.errors).toBeDefined();
  });

  it('should allow register mutation without auth', async () => {
    const user = UserBuilder.aUser().build();

    const response = await graphqlRequest<{ register: { accessToken: string; refreshToken: string } }>(
      app,
      `
        mutation Register($input: RegisterInput!) {
          register(input: $input) {
            accessToken
            refreshToken
          }
        }
      `,
      {
        input: {
          fullName: user.fullName,
          email: user.email,
          phone: user.phone,
          password: user.password,
        },
      },
    );

    expect(response.errors).toBeUndefined();
  });

  it('should allow login mutation without auth', async () => {
    const response = await graphqlRequest<{ login: { accessToken: string } }>(
      app,
      `
        mutation {
          login(input: {
            identifier: "test@test.com",
            password: "Password123"
          }) {
            accessToken
          }
        }
      `,
    );

    expect(response.data).toBeDefined();
  });

  it('should reject wallet query with invalid JWT', async () => {
    const response = await graphqlRequest(
      app,
      `
        query {
          wallet(userId: "some-id") {
            id
          }
        }
      `,
      undefined,
      'invalid.jwt.token',
    );

    expect(response.errors).toBeDefined();
  });
});
