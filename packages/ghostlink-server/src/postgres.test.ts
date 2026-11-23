import { describe, expect, it, vi } from 'vitest';
import { createPostgresStorage, migratePostgresStorage, type PostgresPool } from './postgres';

describe('Postgres failure handling', () => {
  it.each(['public', 'pg_catalog', 'information_schema', 'bad"; DROP SCHEMA public;--', 'a'.repeat(64)])('rejects unsafe schema %s before acquiring a connection', async schema => {
    const pool = { connect: vi.fn() };
    expect(() => createPostgresStorage(pool, { schema })).toThrow();
    await expect(migratePostgresStorage(pool, { schema })).rejects.toThrow();
    expect(pool.connect).not.toHaveBeenCalled();
  });
  it('releases a connection after read failure', async () => {
    const release = vi.fn(); const failure = new Error('offline');
    const pool: PostgresPool = { connect: async () => ({ query: async () => { throw failure; }, release }) };
    await expect(createPostgresStorage(pool).getBrowser('a', 1)).rejects.toBe(failure);
    expect(release).toHaveBeenCalledOnce();
  });
  it('discards a broken transaction connection without hiding the original failure', async () => {
    const release = vi.fn(); const failure = new Error('connection lost');
    const query = vi.fn(async (sql: string) => {
      if (sql.startsWith('BEGIN')) return { rows: [] };
      throw failure;
    });
    const pool: PostgresPool = { connect: async () => ({ query, release }) };
    await expect(createPostgresStorage(pool).revokeBrowser('a')).rejects.toBe(failure);
    expect(query).toHaveBeenLastCalledWith('ROLLBACK');
    expect(release).toHaveBeenCalledExactlyOnceWith(true);
  });
  it('does not retry an ambiguous COMMIT', async () => {
    const release = vi.fn(); const failure = new Error('commit response lost');
    const query = vi.fn(async (sql: string) => {
      if (sql === 'COMMIT') throw failure;
      return { rows: [] };
    });
    const connect = vi.fn(async () => ({ query, release }));
    await expect(createPostgresStorage({ connect }).revokeBrowser('missing')).rejects.toBe(failure);
    expect(connect).toHaveBeenCalledOnce();
    expect(query.mock.calls.filter(([sql]) => sql === 'COMMIT')).toHaveLength(1);
    expect(release).toHaveBeenCalledOnce();
  });
});
