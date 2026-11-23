import { Pool } from '@neondatabase/serverless';
import { migratePostgresStorage } from '@ghostdagger/ghostlink-server/postgres';

const connectionString = process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error('Set MIGRATION_DATABASE_URL or DATABASE_URL before migrating.');
const pool = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 10000 });
try {
  await migratePostgresStorage(pool, { schema: process.env.GHOSTLINK_DATABASE_SCHEMA });
  console.log('Ghostlink website Postgres schema is ready.');
} catch {
  console.error('Ghostlink migration failed. Check the database connection, permissions, and schema version.');
  process.exitCode = 1;
} finally { await pool.end(); }
