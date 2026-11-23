import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { migratePostgresStorage } from '../../packages/ghostlink-server/src/postgres';
import { startNeonProxy } from '../postgres/neon-proxy';

const connectionString = process.env.GHOSTLINK_TEST_DATABASE_URL;
if (!connectionString) throw new Error('Set GHOSTLINK_TEST_DATABASE_URL to an isolated Postgres database.');
const schema = `gl_e2e_${randomUUID().replaceAll('-', '')}`;
const pool = new Pool({ connectionString });
const proxy = await startNeonProxy(connectionString);
await migratePostgresStorage(pool, { schema });
const example = fileURLToPath(new URL('../../examples/vercel-neon/', import.meta.url));
const preload = fileURLToPath(new URL('./neon-preload.mjs', import.meta.url));
const child = spawn(process.execPath, [`${example}node_modules/next/dist/bin/next`, 'start', '--hostname', '127.0.0.1', '--port', '3200'], {
  cwd: example, stdio: 'inherit',
  env: { ...process.env, NODE_OPTIONS: `--import=${preload}`, VERCEL: '', DATABASE_URL: connectionString,
    GHOSTLINK_DATABASE_SCHEMA: schema, GHOSTLINK_ORIGIN: 'http://localhost:3200',
    GHOSTLINK_ALLOW_INSECURE_LOCALHOST: 'true', GHOSTLINK_TEST_WS_PROXY: proxy.address },
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
