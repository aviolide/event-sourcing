import 'reflect-metadata';
import { DataSource } from 'typeorm';

import { truncateAllPublicTables } from '../../shared/db.helper';
import { assertUniqueEmails } from '../../shared/invariants';
import {
  startTestEnvironment,
  getConfig,
} from '../../shared/containers/test-environment';
import { UserBuilder } from '../../shared/builders/user.builder';
import { postJson } from '../../shared/http-e2e.helper';

interface AuthResponseBody {
  user: {
    id: string;
    email: string;
    fullName: string;
  };
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
}

describe('User Registration Flow E2E', () => {
  let dataSource: DataSource;
  let config: ReturnType<typeof getConfig>;
  let authUrl: string;

  beforeAll(async () => {
    config = await startTestEnvironment(['auth']);
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

  it('should register a new user and return tokens', async () => {
    const user = UserBuilder.aUser().build();

    const response = await postJson<AuthResponseBody>(
      `${authUrl}/auth/register`,
      user,
    );

    expect(response.status).toBe(201);
    expect(response.body.user).toBeDefined();
    expect(response.body.user.email).toBe(user.email);
    expect(response.body.user.fullName).toBe(user.fullName);
    expect(response.body.tokens.accessToken).toBeDefined();
    expect(response.body.tokens.refreshToken).toBeDefined();
  });

  it('should emit user.created Kafka event after registration', async () => {
    const user = UserBuilder.aUser().build();

    const response = await postJson<AuthResponseBody>(
      `${authUrl}/auth/register`,
      user,
    );

    expect(response.status).toBe(201);
    const userId = response.body.user.id;
    const events = await dataSource.query(
      `SELECT * FROM users WHERE id = $1`,
      [userId],
    );

    expect(events).toHaveLength(1);
    expect(events[0].email).toBe(user.email);
    expect(events[0].fullName).toBe(user.fullName);
  });

  it('should reject duplicate email registration', async () => {
    const user = UserBuilder.aUser().build();

    await postJson(`${authUrl}/auth/register`, user);

    const response = await postJson(`${authUrl}/auth/register`, user);

    expect(response.status).toBe(500);
  });

  it('should reject invalid registration body', async () => {
    const response = await postJson(`${authUrl}/auth/register`, {
      fullName: 'A',
      password: 'short',
    });

    expect(response.status).toBe(400);
  });

  it('should persist user in database with unique email', async () => {
    const user = UserBuilder.aUser().build();

    await postJson(`${authUrl}/auth/register`, user);

    await assertUniqueEmails(dataSource);

    const rows = await dataSource.query(
      `SELECT * FROM users WHERE email = $1`,
      [user.email],
    );
    expect(rows).toHaveLength(1);
  });
});
