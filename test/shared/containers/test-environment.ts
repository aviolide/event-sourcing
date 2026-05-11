import { execFile } from 'child_process';
import { promisify } from 'util';
import { resolve } from 'path';
import { Client } from 'pg';
import { Kafka } from 'kafkajs';
import { waitUntil } from '../wait-until';

const execFileAsync = promisify(execFile);
let started = false;
let ownsCompose = false;

export type TestEnvironmentMode = 'compose' | 'external';

export interface PostgresConnectionParams {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  url: string;
}

export interface TestEnvironmentConfig {
  mode: TestEnvironmentMode;
  postgres: PostgresConnectionParams;
  kafka: { broker: string };
  services: {
    gatewayUrl: string;
    authUrl: string;
    walletUrl: string;
    paymentsUrl: string;
  };
}

export async function startTestEnvironment(): Promise<TestEnvironmentConfig> {
  const mode = getMode();
  const config = getConfig(mode);
  if (started) return config;
  if (config.mode === 'compose') {
    await startDockerCompose();
    ownsCompose = true;
  }

  await waitForPostgres(config.postgres);
  await waitForKafka(config.kafka.broker);
  started = true;

  return config;
}

export async function stopTestEnvironment(): Promise<void> {
  if (ownsCompose) {
    await execFileAsync('docker', [
      'compose',
      '-f',
      composeFile(),
      '-p',
      composeProjectName(),
      'down',
      '--remove-orphans',
    ]);
  }
  ownsCompose = false;
  started = false;
}

export function getConfig(mode = getMode()): TestEnvironmentConfig {
  const postgres = getPostgresConnectionParams(mode);
  return {
    mode,
    postgres,
    kafka: { broker: getEnv('KAFKA_BROKER', 'localhost:9092') },
    services: {
      gatewayUrl: getEnv('GATEWAY_SERVICE_URL', 'http://localhost:3000'),
      authUrl: getEnv(
        'GATEWAY_AUTH_SERVICE_URL',
        getEnv('AUTH_SERVICE_URL', 'http://localhost:3010'),
      ),
      walletUrl: getEnv(
        'GATEWAY_WALLET_SERVICE_URL',
        getEnv('WALLET_SERVICE_URL', 'http://localhost:3020'),
      ),
      paymentsUrl: getEnv(
        'GATEWAY_PAYMENTS_SERVICE_URL',
        getEnv('PAYMENTS_SERVICE_URL', 'http://localhost:3030'),
      ),
    },
  };
}

export function isStarted(): boolean {
  return started;
}

function getMode(): TestEnvironmentMode {
  return process.env.E2E_INFRA_MODE === 'external' ? 'external' : 'compose';
}

function getPostgresConnectionParams(mode = getMode()): PostgresConnectionParams {
  const host = mode === 'compose' ? 'localhost' : getEnv('DB_HOST', 'localhost');
  const port = mode === 'compose'
    ? Number(getEnv('POSTGRES_PORT', '5432'))
    : Number(getEnv('DB_PORT', getEnv('POSTGRES_PORT', '5432')));
  const database = mode === 'compose'
    ? getEnv('POSTGRES_DB', 'wallet_test')
    : getEnv('DB_NAME', getEnv('POSTGRES_DB', 'wallet_test'));
  const username = mode === 'compose'
    ? getEnv('POSTGRES_USER', 'postgres')
    : getEnv('DB_USERNAME', getEnv('POSTGRES_USER', 'postgres'));
  const password = mode === 'compose'
    ? getEnv('POSTGRES_PASSWORD', 'postgres')
    : getEnv('DB_PASSWORD', getEnv('POSTGRES_PASSWORD', 'postgres'));

  return {
    host,
    port,
    database,
    username,
    password,
    url: `postgresql://${username}:${password}@${host}:${port}/${database}`,
  };
}

function getEnv(name: string, fallback: string): string {
  return process.env[name] || fallback;
}

function composeFile(): string {
  return resolve(process.env.E2E_COMPOSE_FILE || 'docker-compose.stage.yaml');
}

function composeProjectName(): string {
  return process.env.E2E_COMPOSE_PROJECT || 'event-sourcing-e2e';
}

async function startDockerCompose(): Promise<void> {
  await execFileAsync('docker', [
    'compose',
    '-f',
    composeFile(),
    '-p',
    composeProjectName(),
    'up',
    '-d',
    'postgres',
    'kafka',
  ]);
}

async function waitForPostgres(config: PostgresConnectionParams): Promise<void> {
  await waitUntil(
    async () => {
      const client = new Client({
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.username,
        password: config.password,
      });

      try {
        await client.connect();
        await client.query('SELECT 1');
        return true;
      } catch {
        return false;
      } finally {
        await client.end().catch(() => undefined);
      }
    },
    { timeout: 60000, interval: 1000, message: 'Postgres is not ready' },
  );
}

async function waitForKafka(broker: string): Promise<void> {
  await waitUntil(
    async () => {
      const kafka = new Kafka({
        clientId: `test-env-check-${Date.now()}`,
        brokers: [broker],
      });
      const admin = kafka.admin();

      try {
        await admin.connect();
        await admin.listTopics();
        return true;
      } catch {
        return false;
      } finally {
        await admin.disconnect().catch(() => undefined);
      }
    },
    { timeout: 60000, interval: 1000, message: 'Kafka is not ready' },
  );
}
