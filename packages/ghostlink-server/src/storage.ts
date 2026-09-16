import type { AuthChallenge, AuthSession } from 'ghostlink-core';
export interface BrowserRecord { hash: string; csrf: string; expiresAt: number; }
export interface ChallengeRecord extends AuthChallenge { browserHash: string; issuedAt: number; }
export interface SessionRecord { hash: string; browserHash: string; session: AuthSession; lastSeen: number; receipt: { profile: string; message: string; signature: string; publicKey?: string }; }
/** All times are Unix milliseconds. commitLogin MUST atomically consume the challenge and create the session. */
export interface GhostlinkStorage {
  getBrowser(hash: string, now: number): Promise<BrowserRecord | null>;
  putBrowser(browser: BrowserRecord): Promise<void>;
  putChallenge(challenge: ChallengeRecord): Promise<void>;
  getChallenge(id: string, browserHash: string): Promise<ChallengeRecord | null>;
  commitLogin(challengeId: string, browserHash: string, now: number, session: SessionRecord): Promise<boolean>;
  getSession(hash: string, browserHash: string, now: number, idleMs: number): Promise<AuthSession | null>;
  revokeBrowser(browserHash: string): Promise<void>;
  consumeRateLimit(key: string, now: number, windowMs: number, maximum: number): Promise<boolean>;
  prune(now: number): Promise<void>;
  close?(): void;
}
