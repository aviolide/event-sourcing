# NestJS Digital Wallet - Test Infrastructure Guide

## Overview

This comprehensive test suite infrastructure supports unit, integration, e2e, contract, chaos, and performance testing using NestJS, Jest, Testcontainers, and TypeORM.

## Structure

```
test/
├── unit/                          # Unit tests (no external dependencies)
│   ├── auth/                      # Auth module unit tests
│   ├── wallet/                    # Wallet module unit tests
│   ├── payments/                  # Payments module unit tests
│   └── gateway/                   # Gateway module unit tests
│
├── integration/                   # Integration tests (with external services)
│   ├── postgres/                  # PostgreSQL database integration
│   ├── kafka/                     # Kafka messaging integration
│   ├── repositories/              # Repository pattern integration
│   ├── outbox/                    # Transactional outbox pattern
│   └── graphql/                   # GraphQL gateway integration
│
├── e2e/                           # End-to-end workflow tests
│   └── *.e2e.spec.ts
│
├── contracts/                     # Contract & schema tests
│   └── *.spec.ts
│
├── chaos/                         # Chaos engineering tests
│   └── *.spec.ts
│
├── performance/                   # Performance & load tests
│   └── *.spec.ts
│
├── replay/                        # Event replay/recovery tests
│   └── *.spec.ts
│
├── fixtures/                      # Static test data
│   └── *.json
│
└── shared/                        # Shared test utilities
    ├── testcontainers/            # Testcontainers setup
    │   ├── postgres-container.ts
    │   ├── kafka-container.ts
    │   └── test-environment.ts
    ├── factories/                 # Test data generation
    │   ├── user.factory.ts
    │   ├── wallet.factory.ts
    │   ├── payment.factory.ts
    │   └── index.ts
    ├── seeders/                   # Database seeders
    │   ├── auth-seeder.ts
    │   ├── wallet-seeder.ts
    │   ├── payment-seeder.ts
    │   └── index.ts
    ├── mocks/                     # Service mocks
    │   ├── jwt.mock.ts
    │   ├── kafka.mock.ts
    │   └── index.ts
    ├── helpers/                   # Testing utilities
    │   ├── test-app.helper.ts
    │   ├── http.helper.ts
    │   ├── jwt.helper.ts
    │   ├── database.helper.ts
    │   └── index.ts
    └── base-test.ts               # Abstract base test class
```

## Installation

### 1. Install dependencies (root)

```bash
npm install
```

### 2. Install service dependencies (per service)

```bash
cd 01-auth && npm install
cd ../02-wallet && npm install
cd ../03-payments && npm install
cd ../00-gateway && npm install
```

## Running Tests

### Root-level commands

```bash
# Run all tests
npm test

# Run specific test type
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:contracts
npm run test:chaos
npm run test:performance

# Watch mode
npm run test:watch

# Coverage report
npm run test:cov

# Debug mode
npm run test:debug
```

### Service-specific commands

```bash
cd 01-auth
npm test                    # Unit tests
npm run test:cov           # Coverage
npm run test:e2e           # E2E tests (if available)
```

## Core Components

### 1. Testcontainers

Automatically spins up isolated PostgreSQL and Kafka containers for each test suite.

**Files:**
- `test/shared/testcontainers/postgres-container.ts` - PostgreSQL container management
- `test/shared/testcontainers/kafka-container.ts` - Kafka container management
- `test/shared/testcontainers/test-environment.ts` - Orchestrates both containers

**Usage:**

```typescript
import { TestEnvironment } from '../shared/testcontainers/test-environment';

describe('My Test Suite', () => {
  beforeAll(async () => {
    const env = TestEnvironment.getInstance();
    await env.start();
  });

  afterAll(async () => {
    const env = TestEnvironment.getInstance();
    await env.stop();
  });

  it('should access PostgreSQL', () => {
    const config = env.getPostgresConfig();
    expect(config.url).toBeTruthy();
  });
});
```

### 2. Test Data Factories

Generate realistic test data with sensible defaults and customization support.

**Factories:**

```typescript
import { UserFactory, WalletFactory, PaymentFactory } from '../shared/factories';

// Generate single user
const user = UserFactory.create();
const customUser = UserFactory.createWithEmail('test@example.com');

// Generate batch
const users = UserFactory.createMany(10);

// Generate wallet with specific balance
const wallet = WalletFactory.createWithBalance(1000);

// Generate payment in specific status
const payment = PaymentFactory.createCompleted();
const payments = PaymentFactory.createManyWithStatus(5, PaymentStatus.PENDING);
```

### 3. Testing Helpers

Utilities for common testing operations.

**Helpers:**

```typescript
import {
  TestAppFactory,
  HttpTestHelper,
  JwtTestHelper,
  DatabaseTestHelper,
} from '../shared/helpers';

// Create test NestJS app
const { app, moduleRef } = await TestAppFactory.create(MyModule);

// Make HTTP requests
const response = await HttpTestHelper.post(app, '/api/users', { email: 'test@example.com' });
HttpTestHelper.assertStatus(response, 201);

// Generate JWT tokens
const token = JwtTestHelper.generateAccessToken(userId, email);
const decoded = JwtTestHelper.decodeToken(token);

// Database operations
await DatabaseTestHelper.clearAllTables(dataSource);
const exists = await DatabaseTestHelper.recordExists(dataSource, UserEntity, { email });
```

### 4. Database Seeders

Populate test databases with realistic data.

```typescript
import { AuthSeeder, WalletSeeder, PaymentSeeder } from '../shared/seeders';

// Seed users
const users = await AuthSeeder.seedUsers(dataSource, 5);

// Seed wallets for user
const wallets = await WalletSeeder.seedUserWallets(dataSource, userId, 3);

// Seed completed payments
const payments = await PaymentSeeder.seedCompletedPayments(
  dataSource,
  fromWalletId,
  toWalletId,
  10,
);
```

### 5. Service Mocks

Mock external services for testing.

```typescript
import {
  MockJwtService,
  MockKafkaProducer,
  MockKafkaConsumer,
} from '../shared/mocks';

// Mock JWT service
const mockJwt = new MockJwtService();
const token = mockJwt.sign({ sub: userId });

// Mock Kafka producer
const mockProducer = new MockKafkaProducer();
await mockProducer.connect();
await mockProducer.send({ topic: 'user.created', messages: [...] });
const messages = mockProducer.getMessagesForTopic('user.created');
```

## Writing Tests

### Unit Test Example

```typescript
import { UserFactory } from '../../shared/factories';

describe('UserService', () => {
  let service: UserService;

  beforeEach(() => {
    service = new UserService();
  });

  it('should hash password correctly', async () => {
    const plainPassword = 'Password123!';
    const hashed = await service.hashPassword(plainPassword);

    expect(hashed).not.toEqual(plainPassword);
    expect(hashed.length).toBeGreaterThan(plainPassword.length);
  });

  it('should validate password hash', async () => {
    const plainPassword = 'Password123!';
    const user = UserFactory.create();

    const isValid = await service.verifyPassword(plainPassword, user.passwordHash);
    expect(isValid).toBe(true); // Will be false since factory hash is different
  });
});
```

### Integration Test Example

```typescript
import { DataSource } from 'typeorm';
import { TestEnvironment } from '../../shared/testcontainers/test-environment';
import { DatabaseTestHelper } from '../../shared/helpers';
import { UserFactory } from '../../shared/factories';

describe('AuthRepository Integration', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    const env = TestEnvironment.getInstance();
    await env.start();

    dataSource = new DataSource({
      type: 'postgres',
      url: env.getPostgresConfig().url,
      entities: [UserEntity],
      synchronize: true,
    });

    await dataSource.initialize();
  });

  afterAll(async () => {
    await dataSource.destroy();
    await TestEnvironment.getInstance().stop();
  });

  it('should save and retrieve user from database', async () => {
    const user = UserFactory.create();
    const userRepository = dataSource.getRepository(UserEntity);

    await userRepository.save(user);
    const retrieved = await userRepository.findOne({ where: { id: user.id } });

    expect(retrieved).toBeDefined();
    expect(retrieved?.email).toEqual(user.email);
  });
});
```

### E2E Test Example

```typescript
import { INestApplication } from '@nestjs/common';
import { HttpTestHelper } from '../../shared/helpers';

describe('Auth E2E', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should register user and return tokens', async () => {
    const response = await HttpTestHelper.post(app, '/auth/register', {
      email: 'test@example.com',
      password: 'Password123!',
      fullName: 'Test User',
      phone: '+11234567890',
    });

    HttpTestHelper.assertStatus(response, 201);
    HttpTestHelper.assertHasProperty(response, 'accessToken');
    HttpTestHelper.assertHasProperty(response, 'refreshToken');
  });
});
```

## Base Test Class

Provides automatic setup/teardown of test environment:

```typescript
import { BaseTest } from '../shared/base-test';

describe('MyService Integration', () => {
  // Extend BaseTest for automatic container lifecycle management
  class MyTest extends BaseTest {
    async beforeEach(): Promise<void> {
      await super.beforeEach();
      // Additional setup
    }

    async afterEach(): Promise<void> {
      // Cleanup
      await super.afterEach();
    }
  }

  it('should have environment config available', () => {
    const config = new MyTest().getEnvironmentConfig();
    expect(config).toBeTruthy();
  });
});
```

## Jest Configuration

### Root Jest Config

File: `jest.config.js`

Defines test projects:
- `unit` - Fast unit tests (60s timeout)
- `integration` - With external services (60s timeout)
- `e2e` - Full workflows (90s timeout)
- `contracts` - Contract testing
- `chaos` - Chaos engineering (120s timeout)
- `performance` - Performance tests (180s timeout)

### Service Jest Configs

Each service has `jest.config.js`:
- `00-gateway/jest.config.js`
- `01-auth/jest.config.js`
- `02-wallet/jest.config.js`
- `03-payments/jest.config.js`

## Best Practices

### 1. Isolation

Each test should be independent:
- Clean database before each test
- Use fresh containers for integration tests
- Mock external services

### 2. Naming

Follow clear naming conventions:
- Files: `*.spec.ts` (unit), `*.e2e.spec.ts` (e2e)
- Describe blocks: noun → verb pattern
- Test names: "should..." format

### 3. Coverage

Track coverage with `npm run test:cov`:
- Target: ≥75% overall
- Critical paths: ≥90%
- Domain logic: ≥85%

### 4. Performance

Keep tests fast:
- Unit tests: < 100ms each
- Integration tests: < 1s each
- E2E tests: < 5s each

## Troubleshooting

### Tests fail with "Container not started"

```bash
# Verify Docker is running
docker --version

# Check container logs
docker logs yupi-postgres
docker logs yupi-kafka
```

### Port conflicts

```bash
# Find port using process (Windows PowerShell)
Get-NetTCPConnection -LocalPort 5432 | Select-Object OwningProcess

# Kill process or use different port
netstat -ano | findstr :5432
```

### TypeScript compilation errors

```bash
# Rebuild TypeScript
npm run build

# Clear ts-jest cache
npm run test -- --clearCache
```

## Performance Optimization

### Parallel Execution

Jest runs tests in parallel by default. Control with:

```bash
npm test -- --maxWorkers=4
npm test -- --runInBand  # Serial execution (slower)
```

### Selective Testing

```bash
# Test specific file
npm test -- auth.spec.ts

# Test specific pattern
npm test -- --testPathPattern=auth

# Test specific describe block
npm test -- -t "UserService"
```

## CI/CD Integration

Example GitHub Actions workflow:

```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm install
      - run: npm run test:unit
      - run: npm run test:integration
      - run: npm run test:cov
```

## Next Steps

1. **Phase 3**: Implement unit tests for each service
2. **Phase 4**: Add integration tests with real containers
3. **Phase 5**: Create E2E workflow tests
4. **Phase 6**: Add contract/Pact tests
5. **Phase 7**: Implement chaos and performance tests

See [plan.md](../../session/plan.md) for detailed implementation roadmap.
