import { DataSource, EntityTarget, ObjectLiteral } from 'typeorm';
import { loadStageEnv } from '../test-env';

let _sharedDataSource: DataSource | null = null;

export async function createTestDataSource(entities: any[] = []): Promise<DataSource> {
  const env = loadStageEnv();
  const ds = new DataSource({
    type: 'postgres',
    host: env.db.host,
    port: env.db.port,
    database: env.db.database,
    username: env.db.username,
    password: env.db.password,
    entities: entities.length > 0 ? entities : undefined,
    synchronize: false,
    logging: false,
  });
  await ds.initialize();
  return ds;
}

export async function getSharedDataSource(entities?: any[]): Promise<DataSource> {
  if (_sharedDataSource?.isInitialized) return _sharedDataSource;
  _sharedDataSource = await createTestDataSource(entities);
  return _sharedDataSource;
}

export async function destroySharedDataSource(): Promise<void> {
  if (_sharedDataSource?.isInitialized) {
    await _sharedDataSource.destroy();
    _sharedDataSource = null;
  }
}

export async function clearTable(
  dataSource: DataSource,
  target: EntityTarget<ObjectLiteral>,
): Promise<void> {
  const repo = dataSource.getRepository(target);
  await repo.delete({});
}

export async function clearAllTables(dataSource: DataSource): Promise<void> {
  const entities = dataSource.entityMetadatas;
  if (entities.length === 0) return;

  const tables = entities.map((meta) => `"${meta.tableName}"`);
  await dataSource.query(
    `TRUNCATE ${tables.join(', ')} RESTART IDENTITY CASCADE`,
  );
}
