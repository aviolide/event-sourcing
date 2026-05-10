import { DataSource } from 'typeorm';
import { loadStageEnv, type StageEnvConfig } from './test-env';
import { clearAllTables, destroySharedDataSource, getSharedDataSource } from './helpers/database.helper';
import * as path from 'path';

export abstract class BaseTest {
  protected dataSource: DataSource;
  protected env: StageEnvConfig;

  async beforeAll(): Promise<void> {
    this.env = loadStageEnv(true); // Allow undefined errors to use fallback
    try {
      this.dataSource = await getSharedDataSource(this.getEntities());
    } catch (error: any) {
      console.warn('Failed to connect to PostgreSQL, using SQLite fallback:', error.message);
      this.dataSource = await this.createSQLiteDataSource();
    }
  }

  async beforeEach(): Promise<void> {
    await ensureConnection(this.dataSource);
    await clearAllTables(this.dataSource);
  }

  async afterEach(): Promise<void> {
    if (this.dataSource?.isInitialized) {
      await clearAllTables(this.dataSource);
    }
  }

  async afterAll(): Promise<void> {
    if (this.dataSource?.isInitialized) {
      await this.dataSource.destroy();
    }
    await destroySharedDataSource();
  }

  protected async createSQLiteDataSource(): Promise<DataSource> {
    const dbPath = path.resolve(process.cwd(), '.test-db', `test-${Date.now()}.sqlite`);
    const ds = new DataSource({
      type: 'sqlite',
      database: dbPath,
      entities: this.getEntities(),
      synchronize: true,
      logging: false,
    });
    await ds.initialize();
    return ds;
  }

  getDataSource(): DataSource {
    return this.dataSource;
  }

  getEnv(): StageEnvConfig {
    return this.env || loadStageEnv(true);
  }

  protected getEntities(): any[] {
    return [];
  }
}

async function ensureConnection(ds: DataSource): Promise<void> {
  if (!ds.isInitialized) {
    await ds.initialize();
  }
}
