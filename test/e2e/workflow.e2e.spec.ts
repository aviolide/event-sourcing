import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { BaseTest } from '../shared/base-test';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';

const authEntitiesPath = '../../01-auth/src/modules/users/infrastructure/entities/user.entity';
const walletEntitiesPath = '../../02-wallet/src/modules/wallets/infrastructure/entities/wallet.entity';
const paymentEntitiesPath = '../../03-payments/src/modules/payments/infrastructure/entities/payment.entity';

describe('E2E Full Workflow', () => {
  class WorkflowTest extends BaseTest {
    protected getEntities(): any[] {
      const entities: any[] = [];
      for (const p of [authEntitiesPath, walletEntitiesPath, paymentEntitiesPath]) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const mod = require(p);
          const Entity = Object.values(mod)[0] as any;
          if (Entity) entities.push(Entity);
        } catch { /* entity not available */ }
      }
      return entities;
    }
  }

  let test: WorkflowTest;
  let dataSource: DataSource;

  beforeAll(async () => {
    test = new WorkflowTest();
    await test.beforeAll();
    dataSource = test.getDataSource();
  });

  beforeEach(async () => {
    await test.beforeEach();
  });

  afterEach(async () => {
    await test.afterEach();
  });

  afterAll(async () => {
    await test.afterAll();
  });

  it('should be connected to the database', () => {
    expect(dataSource.isInitialized).toBe(true);
  });

  it('should clean tables between tests', async () => {
    for (const meta of dataSource.entityMetadatas) {
      const count = await dataSource.getRepository(meta.name).count();
      expect(count).toBe(0);
    }
  });

  describe('User Registration Workflow', () => {
    it('should create a new user in the database', async () => {
      const userRepo = dataSource.getRepository('UserEntity');
      const userData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        fullName: 'John Doe',
        email: 'john@example.com',
        phone: '+1234567890',
        passwordHash: await bcrypt.hash('password123', 10),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await userRepo.save(userData);

      // Verify user was created
      const user = await userRepo.findOne({
        where: { id: userData.id },
      });
      expect(user).toBeDefined();
      expect(user.email).toBe('john@example.com');
      expect(user.fullName).toBe('John Doe');
    });

    it('should not allow duplicate email addresses', async () => {
      const userRepo = dataSource.getRepository('UserEntity');
      const email = 'duplicate@example.com';
      const userData = {
        id: '123e4567-e89b-12d3-a456-426614174001',
        fullName: 'First User',
        email,
        phone: '+1111111111',
        passwordHash: await bcrypt.hash('password123', 10),
      };

      await userRepo.save(userData);

      // Try to create duplicate
      const duplicateData = {
        id: '223e4567-e89b-12d3-a456-426614174001',
        fullName: 'Second User',
        email, // Same email
        phone: '+2222222222',
        passwordHash: await bcrypt.hash('password123', 10),
      };

      try {
        await userRepo.save(duplicateData);
        fail('Should have thrown an error for duplicate email');
      } catch (error: any) {
        expect(error.message).toContain('duplicate');
      }
    });
  });

  describe('Wallet Workflow', () => {
    let userId: string;

    beforeEach(async () => {
      // Create a test user first
      const userRepo = dataSource.getRepository('UserEntity');
      userId = '323e4567-e89b-12d3-a456-426614174002';
      await userRepo.save({
        id: userId,
        fullName: 'Wallet Test User',
        email: `wallet-user-${Date.now()}@example.com`,
        phone: `+${Math.floor(Math.random() * 10000000000)}`,
        passwordHash: await bcrypt.hash('password123', 10),
      });
    });

    it('should create a wallet for a user', async () => {
      const walletRepo = dataSource.getRepository('WalletEntity');
      const walletId = '123e4567-e89b-12d3-a456-426614175000';

      const walletData = {
        id: walletId,
        userId,
        balance: '1000.00',
        currency: 'PEN',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await walletRepo.save(walletData);

      const wallet = await walletRepo.findOne({
        where: { id: walletId },
      });

      expect(wallet).toBeDefined();
      expect(wallet.userId).toBe(userId);
      expect(wallet.balance).toBe('1000.00');
      expect(wallet.currency).toBe('PEN');
    });

    it('should maintain wallet balance correctly', async () => {
      const walletRepo = dataSource.getRepository('WalletEntity');
      const walletId = '123e4567-e89b-12d3-a456-426614175001';

      // Create wallet with initial balance
      await walletRepo.save({
        id: walletId,
        userId,
        balance: '500.00',
        currency: 'PEN',
      });

      // Update balance (simulate deposit)
      await walletRepo.update({ id: walletId }, { balance: '700.00' });

      const wallet = await walletRepo.findOne({ where: { id: walletId } });
      expect(wallet.balance).toBe('700.00');
    });
  });

  describe('Payment Workflow', () => {
    let fromUserId: string;
    let toUserId: string;
    let fromWalletId: string;
    let toWalletId: string;

    beforeEach(async () => {
      const userRepo = dataSource.getRepository('UserEntity');
      const walletRepo = dataSource.getRepository('WalletEntity');

      // Create two users
      fromUserId = '423e4567-e89b-12d3-a456-426614174003';
      toUserId = '523e4567-e89b-12d3-a456-426614174004';

      await userRepo.save({
        id: fromUserId,
        fullName: 'Sender User',
        email: `sender-${Date.now()}@example.com`,
        phone: `+${Math.floor(Math.random() * 10000000000)}`,
        passwordHash: await bcrypt.hash('password123', 10),
      });

      await userRepo.save({
        id: toUserId,
        fullName: 'Receiver User',
        email: `receiver-${Date.now()}@example.com`,
        phone: `+${Math.floor(Math.random() * 10000000000)}`,
        passwordHash: await bcrypt.hash('password123', 10),
      });

      // Create wallets for both users
      fromWalletId = '623e4567-e89b-12d3-a456-426614175002';
      toWalletId = '723e4567-e89b-12d3-a456-426614175003';

      await walletRepo.save([
        {
          id: fromWalletId,
          userId: fromUserId,
          balance: '1000.00',
          currency: 'PEN',
        },
        {
          id: toWalletId,
          userId: toUserId,
          balance: '500.00',
          currency: 'PEN',
        },
      ]);
    });

    it('should create a payment record', async () => {
      const paymentRepo = dataSource.getRepository('PaymentEntity');
      const paymentId = '823e4567-e89b-12d3-a456-426614176000';
      const amount = '100.00';

      const paymentData = {
        id: paymentId,
        fromUserId,
        toUserId,
        amount,
        currency: 'PEN',
        status: 'PENDING',
        description: 'Test payment',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await paymentRepo.save(paymentData);

      const payment = await paymentRepo.findOne({ where: { id: paymentId } });
      expect(payment).toBeDefined();
      expect(payment.fromUserId).toBe(fromUserId);
      expect(payment.amount).toBe(amount);
      expect(payment.status).toBe('PENDING');
    });

    it('should complete a payment transfer workflow', async () => {
      const paymentRepo = dataSource.getRepository('PaymentEntity');
      const walletRepo = dataSource.getRepository('WalletEntity');
      const paymentId = '923e4567-e89b-12d3-a456-426614176001';
      const transferAmount = '150.00';

      // 1. Create payment in PENDING status
      await paymentRepo.save({
        id: paymentId,
        fromUserId,
        toUserId,
        amount: transferAmount,
        currency: 'PEN',
        status: 'PENDING',
        description: 'Complete transfer test',
      });

      // 2. Deduct from sender's wallet
      await walletRepo.update(
        { id: fromWalletId },
        { balance: '850.00' } // 1000 - 150
      );

      // 3. Add to receiver's wallet
      await walletRepo.update(
        { id: toWalletId },
        { balance: '650.00' } // 500 + 150
      );

      // 4. Update payment status to COMPLETED
      await paymentRepo.update(
        { id: paymentId },
        { status: 'COMPLETED' }
      );

      // Verify final state
      const payment = await paymentRepo.findOne({ where: { id: paymentId } });
      const senderWallet = await walletRepo.findOne({
        where: { id: fromWalletId },
      });
      const receiverWallet = await walletRepo.findOne({
        where: { id: toWalletId },
      });

      expect(payment.status).toBe('COMPLETED');
      expect(senderWallet.balance).toBe('850.00');
      expect(receiverWallet.balance).toBe('650.00');
    });

    it('should track multiple payments for a user', async () => {
      const paymentRepo = dataSource.getRepository('PaymentEntity');

      // Create multiple payments from the same user
      const payments = [
        {
          id: 'a23e4567-e89b-12d3-a456-426614176002',
          fromUserId,
          toUserId,
          amount: '50.00',
          currency: 'PEN',
          status: 'COMPLETED',
        },
        {
          id: 'b23e4567-e89b-12d3-a456-426614176003',
          fromUserId,
          toUserId,
          amount: '75.00',
          currency: 'PEN',
          status: 'PENDING',
        },
      ];

      await paymentRepo.save(payments);

      // Verify both payments exist
      const userPayments = await paymentRepo.find({
        where: { fromUserId },
      });

      expect(userPayments).toHaveLength(2);
      expect(userPayments.some((p) => p.status === 'COMPLETED')).toBe(true);
      expect(userPayments.some((p) => p.status === 'PENDING')).toBe(true);
    });
  });

  describe('Complete End-to-End Workflow', () => {
    it('should execute a complete user -> wallet -> payment flow', async () => {
      const userRepo = dataSource.getRepository('UserEntity');
      const walletRepo = dataSource.getRepository('WalletEntity');
      const paymentRepo = dataSource.getRepository('PaymentEntity');

      // Step 1: Register two users
      const userIds = [
        'c23e4567-e89b-12d3-a456-426614174005',
        'd23e4567-e89b-12d3-a456-426614174006',
      ];
      const users = [
        {
          id: userIds[0],
          fullName: 'Alice',
          email: `alice-${Date.now()}@example.com`,
          phone: '+11111111111',
          passwordHash: await bcrypt.hash('password123', 10),
        },
        {
          id: userIds[1],
          fullName: 'Bob',
          email: `bob-${Date.now()}@example.com`,
          phone: '+22222222222',
          passwordHash: await bcrypt.hash('password123', 10),
        },
      ];

      await userRepo.save(users);

      // Step 2: Create wallets for both users
      const walletIds = [
        'e23e4567-e89b-12d3-a456-426614175004',
        'f23e4567-e89b-12d3-a456-426614175005',
      ];
      const wallets = [
        {
          id: walletIds[0],
          userId: userIds[0],
          balance: '5000.00',
          currency: 'PEN',
        },
        {
          id: walletIds[1],
          userId: userIds[1],
          balance: '2000.00',
          currency: 'PEN',
        },
      ];

      await walletRepo.save(wallets);

      // Step 3: Execute payment from Alice to Bob
      const paymentId = 'g23e4567-e89b-12d3-a456-426614176004';
      const transferAmount = '500.00';

      // Create payment
      await paymentRepo.save({
        id: paymentId,
        fromUserId: userIds[0],
        toUserId: userIds[1],
        amount: transferAmount,
        currency: 'PEN',
        status: 'PENDING',
        description: 'E2E workflow test payment',
      });

      // Update wallets
      await walletRepo.update(
        { id: walletIds[0] },
        { balance: '4500.00' } // 5000 - 500
      );

      await walletRepo.update(
        { id: walletIds[1] },
        { balance: '2500.00' } // 2000 + 500
      );

      // Complete payment
      await paymentRepo.update({ id: paymentId }, { status: 'COMPLETED' });

      // Step 4: Verify final state
      const aliceData = await userRepo.findOne({ where: { id: userIds[0] } });
      const bobData = await userRepo.findOne({ where: { id: userIds[1] } });
      const aliceWallet = await walletRepo.findOne({
        where: { id: walletIds[0] },
      });
      const bobWallet = await walletRepo.findOne({
        where: { id: walletIds[1] },
      });
      const payment = await paymentRepo.findOne({ where: { id: paymentId } });

      // Verify users exist
      expect(aliceData.fullName).toBe('Alice');
      expect(bobData.fullName).toBe('Bob');

      // Verify wallet balances
      expect(aliceWallet.balance).toBe('4500.00');
      expect(bobWallet.balance).toBe('2500.00');

      // Verify payment
      expect(payment.status).toBe('COMPLETED');
      expect(Number(payment.amount)).toBe(500);
    });
  });
});
