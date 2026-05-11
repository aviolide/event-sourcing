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
    id: string;
  };
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
}

describe('Token Refresh Flow E2E', () => {
  let dataSource: DataSource;
  let authUrl: string;

  beforeAll(async () => {
    const config = await startTestEnvironment(['auth']);
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

  async function registerAndGetTokens() {
    const user = UserBuilder.aUser().build();
    const res = await postJson<AuthResponseBody>(`${authUrl}/auth/register`, user);

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

    const response = await postJson<AuthResponseBody>(
      `${authUrl}/auth/refresh`,
      { refreshToken },
      accessToken,
    );

    expect(response.status).toBe(201);
    expect(response.body.tokens.accessToken).toBeDefined();
    expect(response.body.tokens.refreshToken).toBeDefined();
    expect(response.body.tokens.accessToken).not.toBe(accessToken);
    expect(response.body.tokens.refreshToken).not.toBe(refreshToken);
  });

  it('should reject reused refresh token', async () => {
    const { accessToken, refreshToken } = await registerAndGetTokens();

    const firstRefresh = await postJson<AuthResponseBody>(
      `${authUrl}/auth/refresh`,
      { refreshToken },
      accessToken,
    );

    expect(firstRefresh.status).toBe(201);
    const newAccessToken = firstRefresh.body.tokens.accessToken;

    const secondRefresh = await postJson(
      `${authUrl}/auth/refresh`,
      { refreshToken },
      newAccessToken,
    );

    expect(secondRefresh.status).toBe(401);
  });

  it('should reject refresh without auth header', async () => {
    const { refreshToken } = await registerAndGetTokens();

    const response = await postJson(`${authUrl}/auth/refresh`, { refreshToken });

    expect(response.status).toBe(401);
  });
});
