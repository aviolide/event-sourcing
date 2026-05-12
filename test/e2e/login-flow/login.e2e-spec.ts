import 'reflect-metadata';
import { DataSource } from 'typeorm';

import { truncateAllPublicTables } from '../../shared/db.helper';
import {
  startTestEnvironment,
} from '../../shared/containers/test-environment';
import { UserBuilder } from '../../shared/builders/user.builder';
import { postJson } from '../../shared/http-e2e.helper';

interface AuthResponseBody {
  user: {
    email: string;
  };
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
}

describe('Login Flow E2E', () => {
  let dataSource: DataSource;
  let authUrl: string;

  beforeAll(async () => {
    const config = await startTestEnvironment(['auth'], true);
    authUrl = config.services.authUrl;

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
  });

  async function registerUser(overrides = {}) {
    const user = UserBuilder.aUser().build();
    const body = { ...user, ...overrides };

    const res = await postJson<AuthResponseBody>(`${authUrl}/auth/register`, body);

    return { ...res.body, password: body.password };
  }

  it('should login with valid credentials', async () => {
    const user = await registerUser();
    console.log('user registered', user)

    const response = await postJson<AuthResponseBody>(`${authUrl}/auth/login`, {
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

    const response = await postJson(`${authUrl}/auth/login`, {
      identifier: user.user.email,
      password: 'WrongPassword123',
    });

    expect(response.status).toBe(401);
  });

  it('should reject login with nonexistent email', async () => {
    const response = await postJson(`${authUrl}/auth/login`, {
      identifier: 'nonexistent@test.com',
      password: 'Password123',
    });

    expect(response.status).toBe(401);
  });

  it('should reject login with invalid body', async () => {
    const response = await postJson(`${authUrl}/auth/login`, {});

    expect(response.status).toBe(400);
  });
});
