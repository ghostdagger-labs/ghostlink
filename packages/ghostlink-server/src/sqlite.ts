import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, chmodSync } from 'node:fs';
import { dirname } from 'node:path';
import type { AuthSession } from 'ghostlink-core';
import type { BrowserRecord, ChallengeRecord, GhostlinkStorage, SessionRecord } from './storage.js';

export function createSqliteStorage(filename: string): GhostlinkStorage {
  if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(filename);
  if (filename !== ':memory:') chmodSync(filename, 0o600);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;');
  const version = (db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version;
  if (version > 1) { db.close(); throw new Error('Unsupported Ghostlink storage schema.'); }
  db.exec(`
    CREATE TABLE IF NOT EXISTS browsers (hash TEXT PRIMARY KEY, csrf TEXT NOT NULL, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS challenges (id TEXT PRIMARY KEY, browser TEXT NOT NULL REFERENCES browsers(hash) ON DELETE CASCADE, expires INTEGER NOT NULL, data TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS challenges_browser ON challenges(browser);
    CREATE TABLE IF NOT EXISTS sessions (hash TEXT PRIMARY KEY, browser TEXT NOT NULL REFERENCES browsers(hash) ON DELETE CASCADE, expires INTEGER NOT NULL, last_seen INTEGER NOT NULL, data TEXT NOT NULL, receipt TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS sessions_browser ON sessions(browser);
    CREATE TABLE IF NOT EXISTS limits (key TEXT PRIMARY KEY, expires INTEGER NOT NULL, count INTEGER NOT NULL);
    PRAGMA user_version=1;
  `);
  function transaction<T>(work: () => T): T {
    db.exec('BEGIN IMMEDIATE');
    try { const result = work(); db.exec('COMMIT'); return result; }
    catch (e) { db.exec('ROLLBACK'); throw e; }
  }
  return {
    async getBrowser(hash, now) { const r = db.prepare('SELECT hash, csrf, expires AS expiresAt FROM browsers WHERE hash=? AND expires>?').get(hash, now); return r ? r as unknown as BrowserRecord : null; },
    async putBrowser(b) { db.prepare('INSERT INTO browsers VALUES (?, ?, ?)').run(b.hash, b.csrf, b.expiresAt); },
    async putChallenge(c) {
      transaction(() => { db.prepare('DELETE FROM challenges WHERE browser=?').run(c.browserHash); db.prepare('INSERT INTO challenges VALUES (?, ?, ?, ?)').run(c.id, c.browserHash, Date.parse(c.expiresAt), JSON.stringify(c)); });
    },
    async getChallenge(id, browserHash) { const r = db.prepare('SELECT data FROM challenges WHERE id=? AND browser=?').get(id, browserHash) as { data: string } | undefined; return r ? JSON.parse(r.data) as ChallengeRecord : null; },
    async commitLogin(id, browserHash, now, record) {
      return transaction(() => {
        const browser = db.prepare('SELECT hash FROM browsers WHERE hash=? AND expires>?').get(browserHash, now);
        if (!browser) return false;
        const consumed = db.prepare('DELETE FROM challenges WHERE id=? AND browser=? AND expires>? RETURNING id').get(id, browserHash, now);
        if (!consumed) return false;
        db.prepare('DELETE FROM sessions WHERE browser=?').run(browserHash);
        db.prepare('INSERT INTO sessions VALUES (?, ?, ?, ?, ?, ?)').run(record.hash, browserHash, Date.parse(record.session.expiresAt), record.lastSeen, JSON.stringify(record.session), JSON.stringify(record.receipt));
        return true;
      });
    },
    async getSession(hash, browserHash, now, idleMs) {
      return transaction(() => {
        const r = db.prepare('SELECT data, expires FROM sessions WHERE hash=? AND browser=? AND expires>? AND last_seen>?').get(hash, browserHash, now, now - idleMs) as { data: string; expires: number } | undefined;
        if (!r) return null;
        db.prepare('UPDATE sessions SET last_seen=? WHERE hash=?').run(now, hash);
        return { ...JSON.parse(r.data) as AuthSession, idleExpiresAt: new Date(Math.min(r.expires, now + idleMs)).toISOString() };
      });
    },
    async revokeBrowser(hash) { transaction(() => { db.prepare('DELETE FROM challenges WHERE browser=?').run(hash); db.prepare('DELETE FROM sessions WHERE browser=?').run(hash); }); },
    async consumeRateLimit(key, now, windowMs, maximum) {
      return transaction(() => {
        db.prepare('INSERT INTO limits VALUES (?, ?, 1) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires<=? THEN 1 ELSE count+1 END, expires=CASE WHEN expires<=? THEN excluded.expires ELSE expires END').run(key, now + windowMs, now, now);
        return Number((db.prepare('SELECT count FROM limits WHERE key=?').get(key) as { count: number }).count) <= maximum;
      });
    },
    async prune(now) { transaction(() => { db.prepare('DELETE FROM browsers WHERE expires<=?').run(now); db.prepare('DELETE FROM challenges WHERE expires<=?').run(now); db.prepare('DELETE FROM sessions WHERE expires<=?').run(now); db.prepare('DELETE FROM limits WHERE expires<=?').run(now); }); },
    close() { db.close(); },
  };
}
