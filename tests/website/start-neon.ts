import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { migratePostgresStorage } from '../../packages/ghostlink-server/src/postgres';
import { startNeonProxy } from '../postgres/neon-proxy';

const connectionString = process.env.GHOSTLINK_TEST_DATABASE_URL;
if (!connectionString) throw new Error('Set GHOSTLINK_TEST_DATABASE_URL to an isolated Postgres database.');
const schema = `gl_website_${randomUUID().replaceAll('-', '')}`;
const pool = new Pool({ connectionString });
const proxy = await startNeonProxy(connectionString);
await migratePostgresStorage(pool, { schema });
const website = fileURLToPath(new URL('../../website/', import.meta.url));
const preload = fileURLToPath(new URL('./neon-preload.mjs', import.meta.url));
const child = spawn(process.execPath, ['.output/server/index.mjs'], {
  cwd: website, stdio: 'inherit',
  env: { ...process.env, NODE_OPTIONS: `--import=${preload}`, VERCEL: '', DATABASE_URL: connectionString,
    GHOSTLINK_DATABASE_SCHEMA: schema, GHOSTLINK_ORIGIN: 'http://127.0.0.1:3311', HOST: '127.0.0.1', PORT: '3311',
    GHOSTLINK_TEST_WS_PROXY: proxy.address },
});
let closing = false;
async function close(code: number) {
  if (closing) return;
  closing = true;
  child.kill('SIGTERM');
  try {
    if (child.exitCode === null && child.signalCode === null) await new Promise<void>(resolve => child.once('exit', () => resolve()));
    await pool.query(`DROP SCHEMA "${schema}" CASCADE`);
  } finally { await pool.end(); await proxy.close(); process.exit(code); }
}
process.on('SIGINT', () => void close(0));
process.on('SIGTERM', () => void close(0));
child.on('exit', code => { if (!closing) void close(code ?? 1); });
