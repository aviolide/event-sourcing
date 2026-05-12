// Load .env.test file for e2e tests
require('dotenv').config({ path: '.env.test' });

// Populate the env vars the payments service's Zod schema requires.
//
// `@nestjs/config`'s `validate` callback runs synchronously inside
// `ConfigModule.forRoot(...)`, which fires the moment `AppModule` is imported.
// Spec files import `AppModule` at the top, so any env assignment that happens
// inside `beforeAll` is too late. Jest evaluates files listed in `setupFiles`
// before it loads the test modules themselves, so this is the safe place to
// seed the payments service's expected configuration.
//
// The placeholder Postgres/Kafka values below only exist so Zod validation
// passes when AppModule is first imported. E2E specs connect to manually
// running infrastructure through DB_*/KAFKA_* env vars.
process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
process.env.PORT = process.env.PORT ?? '3030';
process.env.DB_HOST = process.env.DB_HOST ?? 'localhost';
process.env.DB_PORT = process.env.DB_PORT ?? '5432';
process.env.DB_NAME = process.env.DB_NAME ?? 'payments_test';
process.env.DB_USERNAME = process.env.DB_USERNAME ?? 'postgres';
process.env.DB_PASSWORD = process.env.DB_PASSWORD ?? 'postgres';
process.env.KAFKA_BROKER = process.env.KAFKA_BROKER ?? 'localhost:9092';
process.env.KAFKA_CLIENT_ID = process.env.KAFKA_CLIENT_ID ?? 'payments-test-client';
process.env.JWT_SECRET =
  process.env.JWT_SECRET ??
  'test-jwt-secret-that-is-at-least-32-characters-long!!';