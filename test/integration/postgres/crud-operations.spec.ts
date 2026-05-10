import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { BaseTest } from '../../shared/base-test';

const entitiesPath = '../../../01-auth/src/modules/users/infrastructure/entities/user.entity';

describe('PostgreSQL CRUD Operations', () => {
  class CrudTest extends BaseTest {
    protected getEntities(): any[] {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { UserEntity } = require(entitiesPath);
        return [UserEntity];
      } catch {
        return [];
      }
    }
  }

  let test: CrudTest;

  beforeAll(async () => {
    test = new CrudTest();
    await test.beforeAll();
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

  it('should connect to the database', () => {
    expect(test.getDataSource().isInitialized).toBe(true);
  });

  it('should have entities loaded', () => {
    const metadata = test.getDataSource().entityMetadatas;
    expect(metadata.length).toBeGreaterThan(0);
  });

  it('should insert and query a record', async () => {
    const ds = test.getDataSource();
    const metadata = ds.entityMetadatas;
    if (metadata.length === 0) return;

    const repo = ds.getRepository(metadata[0].name);
    const record = repo.create({
      id: '00000000-0000-0000-0000-000000000001',
      email: 'test@example.com',
      fullName: 'Test User',
      phone: '+11234567890',
      passwordHash: 'hash123',
    });
    const saved = await repo.save(record);
    expect(saved).toBeTruthy();
  });

  it('should query inserted records', async () => {
    const ds = test.getDataSource();
    const metadata = ds.entityMetadatas;
    if (metadata.length === 0) return;

    const repo = ds.getRepository(metadata[0].name);
    const found = await repo.findOne({ where: { email: 'test@example.com' } });
    expect(found).toBeNull();

    await repo.save(repo.create({
      id: '00000000-0000-0000-0000-000000000002',
      email: 'findme@example.com',
      fullName: 'Find Me',
      phone: '+10987654321',
      passwordHash: 'hash456',
    }));
    const found2 = await repo.findOne({ where: { email: 'findme@example.com' } });
    expect(found2).toBeTruthy();
    expect(found2!.fullName).toBe('Find Me');
  });

  it('should update a record', async () => {
    const ds = test.getDataSource();
    const metadata = ds.entityMetadatas;
    if (metadata.length === 0) return;

    const repo = ds.getRepository(metadata[0].name);
    await repo.save(repo.create({
      id: '00000000-0000-0000-0000-000000000003',
      email: 'update@example.com',
      fullName: 'Original Name',
      phone: '+11111111111',
      passwordHash: 'hash789',
    }));
    const record = await repo.findOne({ where: { email: 'update@example.com' } });
    await repo.update(record!.id, { fullName: 'Updated Name' });
    const updated = await repo.findOne({ where: { email: 'update@example.com' } });
    expect(updated!.fullName).toBe('Updated Name');
  });

  it('should delete a record', async () => {
    const ds = test.getDataSource();
    const metadata = ds.entityMetadatas;
    if (metadata.length === 0) return;

    const repo = ds.getRepository(metadata[0].name);
    await repo.save(repo.create({
      id: '00000000-0000-0000-0000-000000000004',
      email: 'delete@example.com',
      fullName: 'Delete Me',
      phone: '+12222222222',
      passwordHash: 'hash999',
    }));
    const record = await repo.findOne({ where: { email: 'delete@example.com' } });
    await repo.delete(record!.id);
    const deleted = await repo.findOne({ where: { email: 'delete@example.com' } });
    expect(deleted).toBeNull();
  });

  it('should start each test with clean tables', async () => {
    const ds = test.getDataSource();
    const metadata = ds.entityMetadatas;
    if (metadata.length === 0) return;

    const repo = ds.getRepository(metadata[0].name);
    const count = await repo.count();
    expect(count).toBe(0);
  });
});
