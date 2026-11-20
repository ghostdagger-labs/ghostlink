import type { AuthChallenge, AuthSession } from '@ghostdagger/ghostlink-core';
export interface BrowserRecord { hash: string; csrf: string; expiresAt: number; }
export interface ChallengeRecord extends AuthChallenge { browserHash: string; issuedAt: number; }
export interface SessionRecord { hash: string; browserHash: string; session: AuthSession; lastSeen: number; receipt: { profile: string; message: string; signature: string; publicKey?: string }; }
/** All times are Unix milliseconds. commitLogin MUST atomically consume the challenge and create the session. */
export interface GhostlinkStorage {
  /** Look up an unexpired browser record by its hashed cookie token. */
  getBrowser(hash: string, now: number): Promise<BrowserRecord | null>;
  /** Persist the browser binding and CSRF token. */
  putBrowser(browser: BrowserRecord): Promise<void>;
  /** Store the new challenge, replacing outstanding challenges for the same browser. */
  putChallenge(challenge: ChallengeRecord): Promise<void>;
  /** Look up a challenge only within its bound browser. commitLogin must still enforce expiry. */
  getChallenge(id: string, browserHash: string): Promise<ChallengeRecord | null>;
  /** Atomically consume one unexpired challenge and replace the browser's session. Return false if already consumed, expired, or browser binding is invalid. */
  commitLogin(challengeId: string, browserHash: string, now: number, session: SessionRecord): Promise<boolean>;
  /** Return null for expired/wrong-browser sessions; otherwise refresh lastSeen and idleExpiresAt, capped by absolute expiry. All time arguments are milliseconds. */
  getSession(hash: string, browserHash: string, now: number, idleMs: number): Promise<AuthSession | null>;
  /** Revoke all sessions and outstanding challenges for this browser. */
  revokeBrowser(browserHash: string): Promise<void>;
  /** Atomically consume a request in the given millisecond window; false means the maximum was exceeded. */
  consumeRateLimit(key: string, now: number, windowMs: number, maximum: number): Promise<boolean>;
  /** Remove expired records. now is Unix milliseconds. */
  prune(now: number): Promise<void>;
  /** Optional synchronous shutdown. The storage creator owns calling this when no requests remain. */
  close?(): void;
}
