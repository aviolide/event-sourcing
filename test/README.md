# Test Suite Index

## 📁 Directory Structure

### `/test/shared/` - Shared Test Infrastructure
Core utilities and abstractions for all tests.

- **containers/** - Stage infrastructure connectors
  - `test-environment.ts` - Connects to docker-compose or external PostgreSQL/Kafka

- **factories/** - Test data generation
  - `user.factory.ts` - User entity builder
  - `wallet.factory.ts` - Wallet entity builder
  - `payment.factory.ts` - Payment entity builder
  - `index.ts` - Exports

- **seeders/** - Database population
  - `auth-seeder.ts` - Seed auth data
  - `wallet-seeder.ts` - Seed wallet data
  - `payment-seeder.ts` - Seed payment data
  - `index.ts` - Exports

- **mocks/** - Service mocks
  - `jwt.mock.ts` - Mock JwtService
  - `kafka.mock.ts` - Mock KafkaProducer/Consumer
  - `index.ts` - Exports

- **helpers/** - Testing utilities
  - `test-app.helper.ts` - NestJS app creation
  - `http.helper.ts` - HTTP request utilities
  - `jwt.helper.ts` - JWT token generation
  - `database.helper.ts` - Database utilities
  - `index.ts` - Exports

- **base-test.ts** - Abstract base class for all tests

### `/test/unit/` - Unit Tests
Fast, isolated tests with mocked dependencies.

```
unit/
├── auth/               # Auth module unit tests
├── wallet/             # Wallet module unit tests
├── payments/           # Payments module unit tests
└── gateway/            # Gateway module unit tests
```

**Run:** `npm run test:unit`

### `/test/integration/` - Integration Tests
Tests with real services and databases.

```
integration/
├── postgres/           # Database operations
├── kafka/              # Message broker operations
├── repositories/       # Repository pattern tests
├── outbox/             # Transactional outbox tests
└── graphql/            # GraphQL gateway tests
```

**Run:** `npm run test:integration`

**Note:** Uses docker-compose stage infrastructure or externally supplied PostgreSQL/Kafka endpoints.

### `/test/e2e/` - End-to-End Tests
Full workflow tests simulating real user scenarios.

- `wallet-transfer.e2e.spec.ts` - Transfer workflow
- `payment-refund.e2e.spec.ts` - Refund workflow
- `auth-refresh.e2e.spec.ts` - Auth refresh workflow
- `replay-recovery.e2e.spec.ts` - Event replay recovery

**Run:** `npm run test:e2e`

### `/test/contracts/` - Contract Tests
Schema validation and API contracts.

- `graphql-schema.spec.ts` - GraphQL schema introspection
- `kafka-events.spec.ts` - Kafka event Pact contracts
- `dto-compatibility.spec.ts` - DTO serialization tests

**Run:** `npm run test:contracts`

### `/test/chaos/` - Chaos Engineering Tests
Failure scenario and resilience tests.

- `kafka-broker-failure.spec.ts` - Broker failure handling
- `replica-lag.spec.ts` - Replication delay handling
- `network-partition.spec.ts` - Network partition resilience
- `duplicate-events.spec.ts` - Duplicate event handling

**Run:** `npm run test:chaos`

### `/test/performance/` - Performance Tests
Load and throughput benchmarks.

- `graphql-load.spec.ts` - GraphQL query load test
- `wallet-concurrency.spec.ts` - Concurrent wallet operations
- `replay-throughput.spec.ts` - Event replay performance

**Run:** `npm run test:performance`

### `/test/replay/` - Event Replay Tests
Event sourcing recovery scenarios.

- `projection-rebuild.spec.ts` - Rebuild projections from events
- `snapshot-recovery.spec.ts` - Recover from snapshots

**Run:** `npm run test` (included in main suite)

### `/test/fixtures/` - Test Data Fixtures
Static JSON/YAML test data files.

(Ready for adding static fixtures as needed)

## 🚀 Quick Start

### Installation
```bash
npm install --workspace .
cd 01-auth && npm install
cd ../02-wallet && npm install
cd ../03-payments && npm install
cd ../00-gateway && npm install
```

### Running Tests
```bash
# All tests
npm test

# By category
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:contracts
npm run test:chaos
npm run test:performance

# Watch mode
npm run test:watch

# Coverage
npm run test:cov
```

## 📚 Usage Examples

### Creating test data
```typescript
import { UserFactory, WalletFactory, PaymentFactory } from '../shared/factories';

const user = UserFactory.create({ email: 'test@example.com' });
const wallet = WalletFactory.createWithBalance(1000);
const payment = PaymentFactory.createCompleted();
```

### Making HTTP requests
```typescript
import { HttpTestHelper } from '../shared/helpers';

const response = await HttpTestHelper.post(app, '/api/users', payload);
HttpTestHelper.assertStatus(response, 201);
```

### Generating JWT tokens
```typescript
import { JwtTestHelper } from '../shared/helpers';

const token = JwtTestHelper.generateAccessToken(userId, email);
const decoded = JwtTestHelper.decodeToken(token);
```

### Using stage infrastructure
```typescript
import { startTestEnvironment } from '../shared/containers/test-environment';

const config = await startTestEnvironment();
process.env.DB_HOST = config.postgres.host;
process.env.KAFKA_BROKER = config.kafka.broker;
```

## 📖 Documentation

- **TEST_INFRASTRUCTURE.md** - Comprehensive guide with examples
- **TEST_QUICK_REF.md** - Quick reference for common tasks
- **jest.config.js** - Root Jest configuration
- **test/shared/base-test.ts** - Base class for tests

## 🔧 Configuration

### Jest Projects (Root)
```javascript
// jest.config.js defines:
- unit (60s timeout)
- integration (60s timeout)
- e2e (90s timeout)
- contracts
- chaos (120s timeout)
- performance (180s timeout)
```

### Service Jest Configs
```
00-gateway/jest.config.js
01-auth/jest.config.js
02-wallet/jest.config.js
03-payments/jest.config.js
```

## 🎯 Test Coverage

### Phase 1-2 Complete ✅
- [x] Stage infrastructure connectors
- [x] Test data factories
- [x] Database seeders
- [x] Service mocks
- [x] Testing helpers
- [x] Jest configuration
- [x] Example tests

### Phase 3 (In Progress)
- [ ] Unit tests for each service
- [ ] Domain logic coverage

### Phase 4 (Ready)
- [ ] Integration tests with real DB
- [ ] Repository tests
- [ ] Kafka integration tests

### Phase 5+ (Ready)
- [ ] E2E workflow tests
- [ ] Contract tests
- [ ] Chaos tests
- [ ] Performance tests

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| Docker containers won't start | Ensure Docker daemon is running |
| Port conflicts | Check for existing containers: `docker ps` |
| Module not found | Run `npm install` in service directory |
| Tests timeout | Increase timeout or check container logs |

## 📞 Support Files

- **Comprehensive guide**: TEST_INFRASTRUCTURE.md
- **Quick reference**: TEST_QUICK_REF.md
- **Base test class**: test/shared/base-test.ts
- **Implementation plan**: test/shared/../../../.../plan.md

---

**Ready to implement Phase 3 unit tests?**

See TEST_INFRASTRUCTURE.md for detailed examples and patterns.
