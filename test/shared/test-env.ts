export interface StageEnvConfig {
  db: {
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
    url: string;
  };
  kafka: {
    broker: string;
  };
}

let _config: StageEnvConfig | null = null;

export function loadStageEnv(): StageEnvConfig {
  if (_config) return _config;

  const host = process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT || process.env.POSTGRES_PORT || '5432', 10);
  const database = process.env.DB_NAME || process.env.POSTGRES_DB || 'wallet_test';
  const username = process.env.DB_USERNAME || process.env.POSTGRES_USER || 'postgres';
  const password = process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD || 'postgres';
  const kafkaBroker = process.env.KAFKA_BROKER || 'localhost:9092';

  _config = {
    db: {
      host,
      port,
      database,
      username,
      password,
      url: `postgresql://${username}:${password}@${host}:${port}/${database}`,
    },
    kafka: {
      broker: kafkaBroker,
    },
  };

  return _config;
}

export function getStageEnv(): StageEnvConfig {
  if (!_config) return loadStageEnv();
  return _config;
}

export function resetStageEnv(): void {
  _config = null;
}
