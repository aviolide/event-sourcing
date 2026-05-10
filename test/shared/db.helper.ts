import { DataSource } from 'typeorm';

export async function truncateAll(dataSource: DataSource): Promise<void> {
  const tables = dataSource.entityMetadatas.map(
    (meta) => `"${meta.tableName}"`,
  );
  if (tables.length === 0) return;
  await dataSource.query(
    `TRUNCATE ${tables.join(', ')} RESTART IDENTITY CASCADE`,
  );
}

export async function truncateAllPublicTables(
  dataSource: DataSource,
): Promise<void> {
  await dataSource.query(`
    DO $$ DECLARE
      r RECORD;
    BEGIN
      FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' RESTART IDENTITY CASCADE';
      END LOOP;
    END $$;
  `);
}
