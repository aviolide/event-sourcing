import { DataSource } from 'typeorm';
import { loadStageEnv, type StageEnvConfig } from './test-env';
import { clearAllTables, destroySharedDataSource, getSharedDataSource } from './helpers/database.helper';
import { truncateAll } from './db.helper';

export abstract class BaseTest {
  protected dataSource: DataSource;
  protected env: StageEnvConfig;

  async beforeAll(): Promise<void> {
    this.env = loadStageEnv();
    try {
      this.dataSource = await getSharedDataSource(this.getEntities());
    } catch (error: any) {
      throw new Error(
        `Failed to connect to PostgreSQL. Ensure manually running DB env vars are available. Original error: ${error.message}`,
      );
    }
  }

  async beforeEach(): Promise<void> {
    await ensureConnection(this.dataSource);
    await truncateAll(this.dataSource);
  }

  async afterEach(): Promise<void> {
    if (this.dataSource?.isInitialized) {
      await truncateAll(this.dataSource);
    }
  }

  async afterAll(): Promise<void> {
    if (this.dataSource?.isInitialized) {
      await this.dataSource.destroy();
    }
    await destroySharedDataSource();
  }

  getDataSource(): DataSource {
    return this.dataSource;
  }

  getEnv(): StageEnvConfig {
    return this.env || loadStageEnv();
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
