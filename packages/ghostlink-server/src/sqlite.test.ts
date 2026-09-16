import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSqliteStorage } from './sqlite';
import { assertStorageConformance } from './storage-conformance';
describe('SQLite storage contract', () => {
  it('passes the reusable asynchronous contract', async () => { const store = createSqliteStorage(':memory:'); try { await assertStorageConformance(store); } finally { store.close?.(); } });
  it('persists across reopen with private file permissions', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'ghostlink-storage-test-')); const path = join(directory, 'state.sqlite');
    try { const a = createSqliteStorage(path); await a.putBrowser({ hash: 'hash', csrf: 'csrf', expiresAt: 1000 }); a.close?.();
      const b = createSqliteStorage(path); expect(await b.getBrowser('hash', 0)).toMatchObject({ csrf: 'csrf' }); b.close?.(); expect(statSync(path).mode & 0o777).toBe(0o600);
    } finally { rmSync(directory, { recursive: true }); }
  });
  it('keeps rate limits atomic across independent database connections', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'ghostlink-concurrent-test-')); const path = join(directory, 'state.sqlite'); const a = createSqliteStorage(path), b = createSqliteStorage(path);
    try { const results = await Promise.all(Array.from({ length: 20 }, (_, i) => (i % 2 ? a : b).consumeRateLimit('same', 1, 1000, 5))); expect(results.filter(Boolean)).toHaveLength(5); }
    finally { a.close?.(); b.close?.(); rmSync(directory, { recursive: true }); }
  });
});
