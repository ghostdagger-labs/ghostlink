import type { Network, ChainId } from './protocol.js';

/** Machine-readable operation failure. Use the code for branching and message for display. */
export type ErrorCode = 'USER_REJECTED' | 'UNAVAILABLE' | 'UNSUPPORTED' | 'NETWORK_MISMATCH' | 'ACCOUNT_CHANGED' | 'BUSY' | 'CANCELLED' | 'EXPIRED' | 'INVALID_SIGNATURE' | 'SERVER_ERROR' | 'INVALID_REQUEST' | 'UNAUTHENTICATED';
/** A typed wallet/controller failure. Cancellation and user rejection are expected outcomes. */
export class GhostlinkError extends Error {
  constructor(public readonly code: ErrorCode, message: string) { super(message); this.name = 'GhostlinkError'; }
}
/** Wallet-reported identity; connection alone does not establish a verified application session. */
export interface WalletAccount {
  /** Full address, including its kaspa: or kaspatest: prefix. */
  address: string;
  /** Network reported by the wallet. */
  network: Network;
  /** Hex public key, when supplied by the wallet. */
  publicKey?: string;
}
/** Native JSON format accepted by the selected adapter; signing never converts between formats. */
export type TransactionFormat = 'kaspa-transaction-json' | 'pskt-json';
/** Signing-only request. Construct the transaction with the wallet's supported SDK first. */
export interface TransactionRequest {
  /** Must appear in the selected wallet's transactionFormats capability. */
  format: TransactionFormat;
  /** Serialized JSON, at most 1,000,000 characters. Ghostlink does not construct the transaction. */
  payload: string;
  /** Must match the current application session's network. */
  network: Network;
  /** Signing address; must match the current wallet account. */
  address: string;
}
/** Wallet-approved transfer that signs and broadcasts, returning a transaction ID. */
export interface TransferRequest {
  /** Full recipient address on the current network. */
  toAddress: string;
  /** Positive bigint amount in sompi; 100,000,000 sompi = 1 KAS. Use parseKasAmount for decimals. */
  amountSompi: bigint;
  /** Nonnegative additional priority fee in sompi. Defaults to 0n; the wallet computes the final fee. */
  priorityFeeSompi?: bigint;
}
/** Runtime capability hints, not proof of wallet identity or real-wallet certification. */
export interface WalletCapabilities {
  /** Whether the adapter can request arbitrary message signatures. */
  messageSigning: boolean;
  /** Native signing-only transaction formats accepted by this adapter. */
  transactionFormats: readonly TransactionFormat[];
  /** Whether the adapter can request a transfer that signs and broadcasts. */
  transfer: boolean;
  /** Evidence for wallet-side domain enforcement; backend verification alone does not establish it. */
  domainBinding: 'unknown' | 'not-enforced' | 'conformance-tested';
  /** Native sign-in or generic compatibility signing. Native failures never fall back silently. */
  authentication: 'compatibility' | 'caip122';
}
/** Implement to integrate a wallet. Provider approval calls are serialized by the controller. */
export interface WalletAdapter {
  /** Stable unique identifier used by connect(id) and saved wallet selection. */
  readonly id: string;
  /** Display name in the chooser. */
  readonly name: string;
  /** Connection route; manual authentication does not imply live wallet connectivity. */
  readonly kind: 'injected' | 'manual' | 'walletconnect';
  /** Short fallback mark when no icon is supplied. */
  readonly mark: string;
  /** Wallet installation/help URL. */
  readonly installUrl: string;
  /** Optional display icon URL. */
  readonly icon?: string;
  /** Current runtime capabilities; discovery reads this value again. */
  readonly capabilities: WalletCapabilities;
  /** Report availability without requesting wallet approval. */
  isAvailable(): boolean;
  /** Request connection approval on the specified network; does not authenticate the application. */
  connect(network: Network): Promise<WalletAccount>;
  /** Read existing wallet identity without requesting approval; null means unavailable or locked. */
  getAccount(): Promise<WalletAccount | null>;
  /** Request approval to sign the exact message and return its signature. */
  signMessage(message: string): Promise<string>;
  /** Optional native authentication route; errors must never fall back to signMessage. */
  signIn?(challenge: AuthChallenge): Promise<{ message: string; signature: string; publicKey?: string }>;
  /** Sign native transaction JSON with wallet approval, without broadcasting. */
  signTransaction?(request: TransactionRequest): Promise<string>;
  /** Request approval to sign and broadcast a transfer; return its transaction ID. */
  sendTransaction?(request: TransferRequest): Promise<string>;
  /** Read balance in bigint sompi; 100,000,000 sompi = 1 KAS. */
  getBalance?(): Promise<bigint>;
  /** Release wallet connectivity if supported; server session revocation is handled separately. */
  disconnect?(): Promise<void>;
  /** Ask the wallet to switch networks, if supported. */
  switchNetwork?(network: Network): Promise<void>;
  /** Notify account/network changes. Return a function that removes this subscription. */
  subscribe?(listener: () => void): () => void;
  /** Read the provider's reported version for compatibility diagnostics. */
  getVersion?(): Promise<string>;
}
/** Browser-bound, single-use server challenge; sign the exact message without reformatting it. */
export interface AuthChallenge {
  /** Opaque challenge identifier sent back during verification. */
  id: string;
  /** Versioned login-message profile. */
  profile: 'ghostlink-kaspa-v1';
  /** Exact message to display and sign. */
  message: string;
  /** Full signing address bound to this challenge. */
  address: string;
  /** Network bound into the signed message. */
  network: Network;
  /** Challenge expiration as an ISO 8601 UTC timestamp. */
  expiresAt: string;
}
/** Verified backend identity. This metadata contains no cookie/token and grants no application roles. */
export interface AuthSession {
  /** Network-qualified account identifier for application user lookup. */
  accountId: string;
  /** Full verified signing address. */
  address: string;
  /** Authenticated network, independent of current wallet availability. */
  network: Network;
  /** Network-qualified chain identifier, such as kaspa:testnet-10. */
  chainId: ChainId;
  /** Verification time as an ISO 8601 UTC timestamp. */
  issuedAt: string;
  /** Absolute expiration as an ISO 8601 UTC timestamp. */
  expiresAt: string;
  /** Last-known idle expiration as an ISO 8601 UTC timestamp; protected requests can extend it. */
  idleExpiresAt: string;
}
/** Fresh verified login callback; never emitted for restoration. Promises are not awaited. */
export type AuthenticationListener = (session: Readonly<AuthSession>) => void | Promise<void>;
/** Override authentication I/O. The default transport uses same-origin HttpOnly cookies and CSRF. */
export interface AuthTransport {
  /** Obtain a browser-bound challenge for this account. */
  challenge(account: WalletAccount): Promise<AuthChallenge>;
  /** Verify the signed challenge on the backend and establish the browser session. */
  verify(input: { challengeId: string; message: string; signature: string; publicKey?: string }): Promise<AuthSession>;
  /** Read the backend session without wallet approval. Honor signal to cancel I/O when possible. */
  session(options?: { signal?: AbortSignal }): Promise<AuthSession | null>;
  /** Revoke the backend session. Reject on failure so revocationPending can report and retry it. */
  logout(): Promise<void>;
}
/** Presentation step for the modal; use initialization and session to decide application access. */
export type FlowStep = 'choose' | 'connecting' | 'review' | 'address' | 'sign' | 'manual' | 'verifying' | 'connected' | 'error' | 'getwallet';
/** idle/restoring: unresolved; ready: identity resolved; error: check failed and can be retried. */
export type InitializationState = 'idle' | 'restoring' | 'ready' | 'error';
/** Read-only consumer view, including nested values in TypeScript. Change state through client methods. */
export interface GhostlinkSnapshot {
  /** Identity is unresolved until ready. Retry a failed check with restoreSession(). */
  readonly initialization: InitializationState;
  /** Session-check failure, separate from wallet-operation error. Null when no check has failed. */
  readonly initializationError: Readonly<{ code: ErrorCode; message: string }> | null;
  /** Whether the modal is open. Control it with open() and close(). */
  readonly open: boolean;
  /** Current modal presentation step; not an authorization signal. */
  readonly step: FlowStep;
  /** An approval operation is pending. Additional approval calls reject with BUSY. */
  readonly busy: boolean;
  /** Application-selected network. Changing it with setNetwork() signs out the current session. */
  readonly network: Network;
  /** Selected adapter ID, or null before selection/after explicit disconnect. */
  readonly walletId: string | null;
  /** Last-known wallet identity; not proof of application authentication. */
  readonly account: Readonly<WalletAccount> | null;
  /** Live wallet availability. A valid server session can exist while disconnected. */
  readonly connection: 'disconnected' | 'connected' | 'manual';
  /** Last-known authentication status. Check initialization before using identity. */
  readonly authentication: 'unauthenticated' | 'authenticating' | 'authenticated';
  /** Verified metadata, possibly retained while unresolved. Only ready + null means signed out. */
  readonly session: Readonly<AuthSession> | null;
  /** Current single-use login challenge, or null outside an active login attempt. */
  readonly challenge: Readonly<AuthChallenge> | null;
  /** Last-known wallet balance in bigint sompi; null means unavailable, not zero. */
  readonly balance: bigint | null;
  /** Most recent wallet-operation failure; initializationError describes session-check failures. */
  readonly error: Readonly<{ code: ErrorCode; message: string }> | null;
  /** Local sign-out occurred but server revocation is unconfirmed; retries run while attached. */
  readonly revocationPending: boolean;
  /** Discovered wallets and runtime capability hints; empty before browser initialization. */
  readonly wallets: readonly WalletDescriptor[];
  /** Active application wallet-request review, or null outside that review. */
  readonly request: Readonly<{ title: string; message: string }> | null;
}
/** Read-only discovered wallet metadata; use client operations instead of editing this view. */
export interface WalletDescriptor {
  /** Stable identifier accepted by connect(id). */
  readonly id: string;
  /** Wallet display name. */
  readonly name: string;
  /** Adapter connection route. */
  readonly kind: WalletAdapter['kind'];
  /** Fallback text mark. */
  readonly mark: string;
  /** Optional display icon URL. */
  readonly icon?: string;
  /** Installation/help URL. */
  readonly installUrl: string;
  /** Whether discovery currently detects the wallet; does not imply permission or authentication. */
  readonly available: boolean;
  /** Read-only runtime hints; supported transactionFormats is also a readonly array. */
  readonly capabilities: Readonly<WalletCapabilities>;
}
/** Construction options. Create one stable client per provider lifetime and per SSR request. */
export interface GhostlinkConfig {
  /** Application metadata shown in review and used to validate the login audience. */
  app: {
    /** Application display name. */
    name: string;
    /** Absolute HTTP(S) application URL; its origin must match the authentication backend. */
    url: string;
    /** Optional application icon URL shown during review. */
    icon?: string;
  };
  /** Application network. Defaults to testnet-11; the server must allow the same network. */
  network?: Network;
  /** Replaces the default KasWare/Kastle adapters. IDs must be unique; [] disables all wallets. */
  adapters?: WalletAdapter[];
  /** Custom transport or same-origin HTTP options. Defaults to /auth/ghostlink with global fetch. */
  auth?: AuthTransport | {
    /** Authentication path matching the backend prefix, without a trailing slash. Defaults to /auth/ghostlink. */
    baseUrl?: string;
    /** Fetch implementation used only for authentication requests. Defaults to globalThis.fetch. */
    fetch?: typeof fetch;
  };
  /** Close the modal after a fresh, verified login. Defaults to true; restoration never triggers it. */
  closeOnAuthenticate?: boolean;
}
