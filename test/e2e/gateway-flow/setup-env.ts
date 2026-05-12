// Populate the env vars the gateway's Zod schema requires.
//
// `@nestjs/config`'s `validate` callback runs synchronously inside
// `ConfigModule.forRoot(...)`, which fires the moment `AppModule` is imported.
// Spec files import `AppModule` at the top, so any env assignment that happens
// inside `beforeAll` is too late. Jest evaluates files listed in `setupFiles`
// before it loads the test modules themselves, so this is the safe place to
// seed the gateway's expected configuration.

// Load .env.test file for e2e tests
require('dotenv').config({ path: '.env.test' });

process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
process.env.PORT = process.env.PORT ?? '3000';
process.env.AUTH_SERVICE_URL =
  process.env.AUTH_SERVICE_URL ??
  process.env.GATEWAY_AUTH_SERVICE_URL ??
  'http://localhost:3010';
process.env.WALLET_SERVICE_URL =
  process.env.WALLET_SERVICE_URL ??
  process.env.GATEWAY_WALLET_SERVICE_URL ??
  'http://localhost:3020';
process.env.PAYMENTS_SERVICE_URL =
  process.env.PAYMENTS_SERVICE_URL ??
  process.env.GATEWAY_PAYMENTS_SERVICE_URL ??
  'http://localhost:3030';
process.env.JWT_SECRET =
  process.env.JWT_SECRET ??
  'test-jwt-secret-that-is-at-least-32-characters-long!!';
process.env.CORS_ORIGINS = process.env.CORS_ORIGINS ?? '';
process.env.RATE_LIMIT_WINDOW_MS = process.env.RATE_LIMIT_WINDOW_MS ?? '60000';
process.env.RATE_LIMIT_MAX = process.env.RATE_LIMIT_MAX ?? '120';
