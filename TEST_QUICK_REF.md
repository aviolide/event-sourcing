# Test Infrastructure Quick Reference

## Running Tests

```bash
# From root directory

# Start manually managed stage services before e2e
pnpm compose:stage:infra
pnpm compose:stage:services

# All tests
npm test

# By type
npm run test:unit                 # Unit tests only
npm run test:integration          # Integration tests with stage infrastructure
npm run test:e2e                  # End-to-end workflows
npm run test:contracts            # Schema & contract tests
npm run test:chaos                # Chaos engineering tests
npm run test:performance          # Load testing
npm run test:watch                # Watch mode

# Coverage
npm run test:cov                  # Full coverage report
npm run test:debug                # Debug mode

# From service directory
cd 01-auth && npm test            # Service unit tests
```

## Quick Examples

### Generate Test Data

```typescript
import { UserFactory, WalletFactory, PaymentFactory } from '../shared/factories';

// Single user
const user = UserFactory.create();
const user = UserFactory.createWithEmail('test@example.com');

// Batch users
const users = UserFactory.createMany(10);

// Wallet with balance
const wallet = WalletFactory.createWithBalance(1000);

// Payment in status
const payment = PaymentFactory.createCompleted();
```

### Make HTTP Requests

```typescript
import { HttpTestHelper } from '../shared/helpers';

const response = await HttpTestHelper.post(app, '/api/auth/register', {
  email: 'test@example.com',
  password: 'Password123!',
  fullName: 'Test User',
  phone: '+11234567890',
});

HttpTestHelper.assertStatus(response, 201);
const accessToken = HttpTestHelper.getValue(response, 'accessToken');
```

### Generate JWT Tokens

```typescript
import { JwtTestHelper } from '../shared/helpers';

const token = JwtTestHelper.generateAccessToken(userId, email);
const refreshToken = JwtTestHelper.generateRefreshToken(userId);
const decoded = JwtTestHelper.decodeToken(token);
```

### Use manually running stage infrastructure

```typescript
import { startTestEnvironment } from '../shared/containers/test-environment';

beforeAll(async () => {
  await startTestEnvironment(['auth']);
});

it('should connect to database', () => {
  const config = getConfig().postgres;
  expect(config.url).toContain('postgresql://');
});
```

### Database Operations

```typescript
import { DatabaseTestHelper } from '../shared/helpers';

// Clear tables
await DatabaseTestHelper.clearAllTables(dataSource);

// Check if record exists
const exists = await DatabaseTestHelper.recordExists(
  dataSource,
  UserEntity,
  { email: 'test@example.com' },
);

// Transaction
await DatabaseTestHelper.inTransaction(dataSource, async (queryRunner) => {
  // run queries
});
```

### Mock Services

```typescript
import { MockJwtService, MockKafkaProducer } from '../shared/mocks';

// Mock JWT
const mockJwt = new MockJwtService();
const token = mockJwt.sign({ sub: userId });

// Mock Kafka
const producer = new MockKafkaProducer();
await producer.connect();
await producer.send({ topic: 'user.created', messages: [...] });
const messages = producer.getMessagesForTopic('user.created');
```

## Common Patterns

### Unit Test Template

```typescript
import { UserFactory } from '../../shared/factories';

describe('MyService', () => {
  let service: MyService;

  beforeEach(() => {
    service = new MyService();
  });

  it('should do something', () => {
    const user = UserFactory.create();
    const result = service.process(user);
    expect(result).toBeTruthy();
  });
});
```

### Integration Test Template

```typescript
import { startTestEnvironment } from '../../shared/containers/test-environment';
import { DatabaseTestHelper } from '../../shared/helpers';

describe('MyRepository Integration', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    const env = await startTestEnvironment();
    // Initialize dataSource with env.postgres.url
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  it('should save and retrieve', async () => {
    await DatabaseTestHelper.clearAllTables(dataSource);
    // Test code
  });
});
```

### E2E Test Template

```typescript
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { HttpTestHelper } from '../../shared/helpers';

describe('Auth E2E', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should register user', async () => {
    const response = await HttpTestHelper.post(app, '/auth/register', {
      // payload
    });
    HttpTestHelper.assertStatus(response, 201);
  });
});
```

## Directory Navigation

```bash
# Navigate to test directories
cd test/unit/auth                    # Auth unit tests
cd test/integration/postgres         # Database integration
cd test/integration/kafka            # Kafka integration
cd test/e2e                          # End-to-end tests
cd test/shared/factories             # Test data builders
cd test/shared/helpers               # Test utilities
cd test/shared/mocks                 # Service mocks
cd test/shared/containers        # Stage infrastructure connectors
```

## Useful Commands

```bash
# Test specific file
npm test -- auth.spec.ts

# Test matching pattern
npm test -- -t "UserService"

# Test with coverage
npm test -- --coverage

# Clear Jest cache
npm test -- --clearCache

# Watch specific file
npm test -- --watch auth.spec.ts

# Run in band (serial, slower but simpler)
npm test -- --runInBand

# Show coverage by file
npm run test:cov -- --verbose
```

## Debugging

### Enable logs
```typescript
// In test
console.log('Debug info:', data);
jest.unmock('module');
```

### Run with Node debugger
```bash
npm run test:debug -- auth.spec.ts
# Then open chrome://inspect
```

### Check stage service status
```bash
curl http://localhost:3010          # Auth service
curl http://localhost:3020          # Wallet service
curl http://localhost:3030          # Payments service
curl http://localhost:3000/graphql  # Gateway service
```

## Performance Tips

1. **Run tests in parallel** (default)
   ```bash
   npm test -- --maxWorkers=4
   ```

2. **Run specific test file** (faster)
   ```bash
   npm test -- auth.spec.ts
   ```

3. **Skip coverage** (faster)
   ```bash
   npm test -- --no-coverage
   ```

4. **Use mocks instead of real services**
   - See `/test/shared/mocks/`

5. **Reuse test environment** across tests
   - Don't restart manual infrastructure per test

## File Locations

| Purpose | Path |
|---------|------|
| Factories | `test/shared/factories/` |
| Seeders | `test/shared/seeders/` |
| Mocks | `test/shared/mocks/` |
| Helpers | `test/shared/helpers/` |
| stage infrastructure | `test/shared/containers/` |
| Unit tests | `test/unit/{service}/` |
| Integration | `test/integration/{service}/` |
| E2E | `test/e2e/` |
| Contracts | `test/contracts/` |
| Chaos | `test/chaos/` |
| Performance | `test/performance/` |
| Base class | `test/shared/base-test.ts` |
| Jest root config | `jest.config.js` |
| Service Jest | `0X-service/jest.config.js` |

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Stage infrastructure timeout" | Increase timeout; verify manual DB/Kafka/services are running |
| "Module not found" | Run `npm install` in service directory |
| "Connection refused" | Verify manually running stage services are reachable |
| "Port already in use" | Use `netstat -ano` to find process |

## Next Phases

After Phase 1-2 foundation:

**Phase 3**: Implement unit tests for each service (4-6 tests per service)
**Phase 4**: Add integration tests with real database (3-5 per service)
**Phase 5**: Create E2E workflow tests (3-5 full flows)
**Phase 6**: Contract and schema tests
**Phase 7**: Chaos and performance tests

See `TEST_INFRASTRUCTURE.md` for detailed guide.
