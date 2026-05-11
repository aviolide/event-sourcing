# Real Database Testing Guide

This guide shows how to write tests that write to real databases and clean up automatically.

## Key Principles

1. **Real Database**: Tests connect to PostgreSQL/Kafka through docker-compose stage infra or external env vars
2. **Automatic Cleanup**: `BaseTest` automatically clears the database before and after each test
3. **Test Isolation**: Each test starts with a clean database (zero data pollution)
4. **Transactions**: Optional transactional execution for advanced scenarios

## Quick Start

### 1. Extend BaseTest

```typescript
import { BaseTest } from '../shared/base-test';
import { DataSource } from 'typeorm';

class MyTest extends BaseTest {
  protected async initializeDataSource(): Promise<DataSource> {
    const config = this.getEnvironmentConfig();

    const dataSource = new DataSource({
      type: 'postgres',
      url: config.postgres.url,
      synchronize: true,
      logging: false,
      entities: [UserEntity, WalletEntity], // Your entities
    });

    await dataSource.initialize();
    return dataSource;
  }

  getDataSourceForTest(): DataSource {
    return this.getDataSource();
  }
}
```

### 2. Setup Lifecycle

```typescript
describe('My Integration Test', () => {
  let testCase: MyTest;

  beforeEach(async () => {
    testCase = new MyTest();
    await testCase.beforeEach();  // Starts containers, clears database
  });

  afterEach(async () => {
    await testCase.afterEach();   // Clears database, closes app
  });

  afterAll(async () => {
    await MyTest.afterAll();      // Stops containers
  });
});
```

### 3. Write Data

```typescript
it('should write user to database', async () => {
  const dataSource = testCase.getDataSourceForTest();

  // Generate test data
  const user = UserFactory.create({ email: 'test@example.com' });

  // Save to database
  const userRepository = dataSource.getRepository(UserEntity);
  const savedUser = await userRepository.save(user);

  // Verify it was saved
  expect(savedUser.id).toBeTruthy();
  expect(savedUser.email).toEqual('test@example.com');

  // Database cleaned automatically after test
});
```

### 4. Query Data

```typescript
it('should query data from database', async () => {
  const dataSource = testCase.getDataSourceForTest();

  // Seed data
  const users = UserFactory.createMany(5);
  const userRepository = dataSource.getRepository(UserEntity);
  await userRepository.save(users);

  // Query from database
  const retrieved = await userRepository.find();

  expect(retrieved).toHaveLength(5);
});
```

### 5. Automatic Cleanup

Each test automatically:

1. **Before each test (`beforeEach`)**:
   - Starts PostgreSQL container (if not running)
   - Initializes DatabaseSource
   - **Clears all tables** for clean state

2. **After each test (`afterEach`)**:
   - **Clears all tables** again
   - Closes NestJS app (if open)

3. **After all tests (`afterAll`)**:
   - Stops PostgreSQL container
   - Stops Kafka container
   - Releases all resources

## Using Seeders

Seeders write data to the database automatically:

```typescript
it('should seed users to database', async () => {
  const dataSource = testCase.getDataSourceForTest();

  // Seeders write directly to database
  const users = await AuthSeeder.seedUsers(dataSource, 5);

  // Verify they were written
  const userRepository = dataSource.getRepository(UserEntity);
  const count = await userRepository.count();
  expect(count).toEqual(5);

  // Automatically cleaned up after test
});
```

### Available Seeders

**Auth Module**:
```typescript
await AuthSeeder.seedUsers(dataSource, count, overrides);
await AuthSeeder.seedDefaultUser(dataSource);
await AuthSeeder.seedUsersByDomain(dataSource, domain, count);
```

**Wallet Module**:
```typescript
await WalletSeeder.seedUserWallets(dataSource, userId, count);
await WalletSeeder.seedWalletsWithBalances(dataSource, userId, [1000, 2000]);
await WalletSeeder.seedMultiCurrencyWallets(dataSource, userId, balance);
await WalletSeeder.seedWalletsForUsers(dataSource, userIds, walletsPerUser);
```

**Payments Module**:
```typescript
await PaymentSeeder.seedPayments(dataSource, fromWallet, toWallet, count);
await PaymentSeeder.seedPendingPayments(dataSource, fromWallet, toWallet, count);
await PaymentSeeder.seedCompletedPayments(dataSource, fromWallet, toWallet, count);
await PaymentSeeder.seedFailedPayments(dataSource, fromWallet, toWallet, count);
```

## Transactions

For advanced scenarios, execute code in transactions:

```typescript
it('should execute in transaction', async () => {
  const result = await testCase.inTransaction(async (dataSource) => {
    const userRepository = dataSource.getRepository(UserEntity);
    const user = UserFactory.create();
    await userRepository.save(user);
    return user;
  });

  // Transaction automatically commits
  expect(result).toBeTruthy();
});

it('should rollback on error', async () => {
  try {
    await testCase.inTransaction(async (dataSource) => {
      throw new Error('Operations failed');
    });
  } catch (error) {
    // Transaction rolled back
    expect(error).toBeTruthy();
  }
});
```

## Database Helpers

Utility functions for common database operations:

```typescript
import { DatabaseTestHelper } from '../shared/helpers';

// Clear all tables
await DatabaseTestHelper.clearAllTables(dataSource);

// Clear specific table
await DatabaseTestHelper.clearTable(dataSource, 'UserEntity');

// Check if record exists
const exists = await DatabaseTestHelper.recordExists(
  dataSource,
  UserEntity,
  { email: 'test@example.com' },
);

// Find one record
const user = await DatabaseTestHelper.findOne(
  dataSource,
  UserEntity,
  { email: 'test@example.com' },
);

// Find many records
const users = await DatabaseTestHelper.findMany(
  dataSource,
  UserEntity,
  { isActive: true },
);

// Count records
const count = await DatabaseTestHelper.count(dataSource, UserEntity);

// Execute raw SQL
const result = await DatabaseTestHelper.executeSql(
  dataSource,
  'SELECT COUNT(*) FROM users'
);
```

## Data Factories

Generate realistic test data:

```typescript
import { UserFactory, WalletFactory, PaymentFactory } from '../shared/factories';

// Single user
const user = UserFactory.create();
const user = UserFactory.createWithEmail('test@example.com');

// Batch users
const users = UserFactory.createMany(10);

// Wallet with balance
const wallet = WalletFactory.createWithBalance(1000);

// Multiple currencies
const wallets = WalletFactory.createMany(3);

// Payment with status
const payment = PaymentFactory.createCompleted();
const payments = PaymentFactory.createManyWithStatus(5, PaymentStatus.PENDING);
```

## Complete Example

```typescript
import { BaseTest } from '../shared/base-test';
import { DataSource } from 'typeorm';
import { UserFactory, WalletFactory } from '../shared/factories';
import { AuthSeeder, WalletSeeder } from '../shared/seeders';

describe('Wallet Service Integration', () => {
  class WalletTest extends BaseTest {
    protected async initializeDataSource(): Promise<DataSource> {
      const config = this.getEnvironmentConfig();
      const dataSource = new DataSource({
        type: 'postgres',
        url: config.postgres.url,
        synchronize: true,
        entities: [UserEntity, WalletEntity],
      });
      await dataSource.initialize();
      return dataSource;
    }

    getDs(): DataSource {
      return this.getDataSource();
    }
  }

  let test: WalletTest;

  beforeEach(async () => {
    test = new WalletTest();
    await test.beforeEach(); // Clean database start
  });

  afterEach(async () => {
    await test.afterEach();  // Automatic cleanup
  });

  afterAll(async () => {
    await WalletTest.afterAll();
  });

  it('should create wallet and check balance', async () => {
    const ds = test.getDs();

    // 1. Seed user
    const user = await AuthSeeder.seedDefaultUser(ds);

    // 2. Create wallet for user
    const walletData = WalletFactory.createForUser(user.id, { balance: 1000 });
    const walletRepository = ds.getRepository(WalletEntity);
    const wallet = await walletRepository.save(walletData);

    // 3. Query and verify
    const retrieved = await walletRepository.findOne({ where: { id: wallet.id } });
    expect(retrieved?.balance).toEqual(1000);

    // Database cleaned automatically after test
  });

  it('should transfer between wallets', async () => {
    const ds = test.getDs();

    // 1. Setup users with wallets
    const sender = await AuthSeeder.seedDefaultUser(ds);
    const senderWallets = await WalletSeeder.seedWalletsWithBalances(
      ds,
      sender.id,
      [1000], // sender has 1000
    );

    const receivers = await AuthSeeder.seedUsers(ds, 1);
    const receiverWallets = await WalletSeeder.seedWalletsWithBalances(
      ds,
      receivers[0].id,
      [0], // receiver has 0
    );

    // 2. Simulate transfer
    const transferAmount = 200;
    const walletRepository = ds.getRepository(WalletEntity);

    // Update sender balance
    senderWallets[0].balance -= transferAmount;
    await walletRepository.save(senderWallets[0]);

    // Update receiver balance
    receiverWallets[0].balance += transferAmount;
    await walletRepository.save(receiverWallets[0]);

    // 3. Verify transfer
    const sender_ = await walletRepository.findOne({ where: { id: senderWallets[0].id } });
    const receiver_ = await walletRepository.findOne({ where: { id: receiverWallets[0].id } });

    expect(sender_?.balance).toEqual(800);
    expect(receiver_?.balance).toEqual(200);
  });

  it('should handle concurrent operations', async () => {
    const ds = test.getDs();

    // Seed user with wallet
    const user = await AuthSeeder.seedDefaultUser(ds);
    const wallet = await WalletSeeder.seedWalletsWithBalances(ds, user.id, [1000]);

    // Simulate concurrent withdrawals
    const withdrawals = [100, 100, 100];
    const walletRepository = ds.getRepository(WalletEntity);

    for (const amount of withdrawals) {
      const current = await walletRepository.findOne({ where: { id: wallet[0].id } });
      current!.balance -= amount;
      await walletRepository.save(current!);
    }

    // Verify final balance
    const final = await walletRepository.findOne({ where: { id: wallet[0].id } });
    expect(final?.balance).toEqual(700);
  });
});
```

## Test Isolation

Each test is completely isolated:

```typescript
it('test 1 - creates data', async () => {
  // Database is clean
  const count1 = await getCount(); // 0
  
  // Create data
  await seedData();
  
  // Database has data
  const count2 = await getCount(); // 5
});

it('test 2 - starts fresh', async () => {
  // Previous test's data was cleaned up
  const count = await getCount(); // 0 (clean!)
  
  // This test independent of previous
});
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Tests fail with "entity not synced" | Load entities in `initializeDataSource()`: `entities: [UserEntity, WalletEntity]` |
| Data not persisting | Use `dataSource.getRepository(Entity).save()` not raw SQL |
| Database locked | Ensure `afterEach()` is called - check Jest configuration |
| Slow tests | Use in-memory mock database for unit tests, real DB for integration |
| Foreign key errors | Call `beforeEach()` to ensure foreign relationships exist |

## Best Practices

1. ✅ **Use BaseTest** for automatic lifecycle management
2. ✅ **Load entities** in `initializeDataSource()`
3. ✅ **Use factories** for test data generation
4. ✅ **Use seeders** for batch operations
5. ✅ **Test real workflows** (not mocks)
6. ✅ **Verify database state** after operations
7. ✅ **Trust automatic cleanup** - don't manually clear tables

## Running Tests

```bash
# Run integration tests
npm run test:integration

# Run specific test file
npm test -- database-operations.advanced.spec.ts

# Run with logs
npm test -- --verbose

# Run in watch mode
npm run test:watch -- database-operations.advanced.spec.ts
```

---

See [TEST_INFRASTRUCTURE.md](../../TEST_INFRASTRUCTURE.md) for complete infrastructure documentation.
