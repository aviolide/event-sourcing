import { Client } from 'pg';
import { Kafka } from 'kafkajs';
import { waitUntil } from '../wait-until';
import { requestOk } from '../http-e2e.helper';

let started = false;
const checkedServices = new Set<TestServiceName>();

export type TestEnvironmentMode = 'external';
export type TestServiceName = 'gateway' | 'auth' | 'wallet' | 'payments';

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

export async function startTestEnvironment(
  services: TestServiceName[] = [],
  skipLaunch = false,
): Promise<TestEnvironmentConfig> {
  const config = getConfig();
  if (started || !skipLaunch) {
    console.log('Test environment already started, checking services:', services);
    await waitForServices(config.services, services);
    return config;
  }

  await waitForPostgres(config.postgres);
  //console.log('Starting test environment after psql:', config)
  // await waitForKafka(config.kafka.broker);
  // await waitForServices(config.services, services);
  started = true;

  return config;
}

export async function stopTestEnvironment(): Promise<void> {
  checkedServices.clear();
  started = false;
}

export function getConfig(): TestEnvironmentConfig {
  const postgres = getPostgresConnectionParams();
  return {
    mode: 'external',
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

function getPostgresConnectionParams(): PostgresConnectionParams {
  const host = getEnv('DB_HOST', 'localhost');
  const port = Number(getEnv('DB_PORT', getEnv('POSTGRES_PORT', '5432')));
  const database = getEnv('DB_NAME', getEnv('POSTGRES_DB', 'wallet_test'));
  const username = getEnv('DB_USERNAME', getEnv('POSTGRES_USER', 'postgres'));
  const password = getEnv('DB_PASSWORD', getEnv('POSTGRES_PASSWORD', 'postgres'));

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

async function waitForServices(
  services: TestEnvironmentConfig['services'],
  serviceNames: TestServiceName[],
): Promise<void> {
  for (const serviceName of serviceNames) {
    if (checkedServices.has(serviceName)) continue;
    await waitForService(serviceName, services[`${serviceName}Url`]);
    checkedServices.add(serviceName);
  }
}

async function waitForService(
  serviceName: TestServiceName,
  url: string,
): Promise<void> {
  await waitUntil(
    async () => {
      return requestOk(url);
    },
    {
      timeout: 10000,
      interval: 1000,
      message: `${serviceName} service is not ready at ${url}`,
    },
  );
}
