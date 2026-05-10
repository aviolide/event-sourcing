import { startPostgresContainer, stopPostgresContainer, getPostgresConnectionParams, PostgresConnectionParams } from './postgres.container';
import { startKafkaContainer, stopKafkaContainer, getKafkaBroker } from './kafka.container';

let started = false;

export interface TestEnvironmentConfig {
  postgres: PostgresConnectionParams;
  kafka: { broker: string };
}

export async function startTestEnvironment(): Promise<TestEnvironmentConfig> {
  if (started) return getConfig();

  await startPostgresContainer();
  await startKafkaContainer();
  started = true;

  return getConfig();
}

export async function stopTestEnvironment(): Promise<void> {
  await stopKafkaContainer();
  await stopPostgresContainer();
  started = false;
}

export function getConfig(): TestEnvironmentConfig {
  return {
    postgres: getPostgresConnectionParams(),
    kafka: { broker: getKafkaBroker() },
  };
}

export function isStarted(): boolean {
  return started;
}
