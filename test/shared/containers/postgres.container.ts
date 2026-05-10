import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';

let container: StartedPostgreSqlContainer | null = null;

export interface PostgresConnectionParams {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  url: string;
}

export async function startPostgresContainer(): Promise<StartedPostgreSqlContainer> {
  if (container) return container;

  container = await new PostgreSqlContainer('postgres:16')
    .withDatabase('wallet_test')
    .withUsername('postgres')
    .withPassword('postgres')
    .start();

  return container;
}

export async function stopPostgresContainer(): Promise<void> {
  if (container) {
    await container.stop();
    container = null;
  }
}

export function getPostgresConnectionParams(): PostgresConnectionParams {
  if (!container) throw new Error('Postgres container not started');

  const host = container.getHost();
  const port = container.getMappedPort(5432);

  return {
    host,
    port,
    database: 'wallet_test',
    username: 'postgres',
    password: 'postgres',
    url: `postgresql://postgres:postgres@${host}:${port}/wallet_test`,
  };
}
