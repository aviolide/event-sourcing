import * as fs from 'fs';
import * as path from 'path';

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

function loadEnvFile(filePath: string): Record<string, string> {
  const env: Record<string, string> = {};
  const content = fs.readFileSync(filePath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (key) env[key] = value;
  }
  return env;
}

export function loadStageEnv(allowMissing = false): StageEnvConfig {
  if (_config) return _config;

  const envPath = path.resolve(process.cwd(), '.env.stage');
  if (!fs.existsSync(envPath)) {
    if (allowMissing) {
      console.warn(`.env.stage not found at ${envPath}. Using defaults for local testing.`);
    } else {
      throw new Error(
        `.env.stage not found at ${envPath}. Create this file with your stage database configuration.`
      );
    }
  }

  const vars = loadEnvFile(fs.existsSync(envPath) ? envPath : '');

  const host = vars.POSTGRES_HOST || '192.168.137.114';
  const port = parseInt(vars.POSTGRES_PORT || '5432', 10);
  const database = vars.POSTGRES_DB || 'yupi_test';
  const username = vars.POSTGRES_USER || 'postgres';
  const password = vars.POSTGRES_PASSWORD || 'postgres';
  const kafkaBroker = vars.KAFKA_BROKER || '192.168.137.114:9092';

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
  if (!_config) return loadStageEnv(true);
  return _config;
}

export function resetStageEnv(): void {
  _config = null;
}

