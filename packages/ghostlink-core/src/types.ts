import type { Network, ChainId } from './protocol.js';
export type ErrorCode = 'USER_REJECTED' | 'UNAVAILABLE' | 'UNSUPPORTED' | 'NETWORK_MISMATCH' | 'ACCOUNT_CHANGED' | 'BUSY' | 'CANCELLED' | 'EXPIRED' | 'INVALID_SIGNATURE' | 'SERVER_ERROR' | 'INVALID_REQUEST' | 'UNAUTHENTICATED';
export class GhostlinkError extends Error {
  constructor(public readonly code: ErrorCode, message: string) { super(message); this.name = 'GhostlinkError'; }
}
export interface WalletAccount { address: string; network: Network; publicKey?: string; }
export type TransactionFormat = 'kaspa-transaction-json' | 'pskt-json';
export interface TransactionRequest { format: TransactionFormat; payload: string; network: Network; address: string; }
export interface TransferRequest { toAddress: string; amountSompi: bigint; priorityFeeSompi?: bigint; }
export interface WalletCapabilities {
  messageSigning: boolean; transactionFormats: readonly TransactionFormat[]; transfer: boolean;
  domainBinding: 'unknown' | 'not-enforced' | 'conformance-tested';
  authentication: 'compatibility' | 'caip122';
}
export interface WalletAdapter {
  readonly id: string; readonly name: string; readonly kind: 'injected' | 'manual' | 'walletconnect';
  readonly mark: string; readonly installUrl: string; readonly icon?: string;
  readonly capabilities: WalletCapabilities;
  isAvailable(): boolean;
  connect(network: Network): Promise<WalletAccount>;
  getAccount(): Promise<WalletAccount | null>;
  signMessage(message: string): Promise<string>;
  /** Optional stronger route; errors must never fall back to signMessage. */
  signIn?(challenge: AuthChallenge): Promise<{ message: string; signature: string; publicKey?: string }>;
  signTransaction?(request: TransactionRequest): Promise<string>;
  sendTransaction?(request: TransferRequest): Promise<string>;
  getBalance?(): Promise<bigint>;
  disconnect?(): Promise<void>;
  switchNetwork?(network: Network): Promise<void>;
  subscribe?(listener: () => void): () => void;
  getVersion?(): Promise<string>;
}
export interface AuthChallenge { id: string; profile: 'ghostlink-kaspa-v1'; message: string; address: string; network: Network; expiresAt: string; }
export interface AuthSession { accountId: string; address: string; network: Network; chainId: ChainId; issuedAt: string; expiresAt: string; idleExpiresAt: string; }
export interface AuthTransport {
  challenge(account: WalletAccount): Promise<AuthChallenge>;
  verify(input: { challengeId: string; message: string; signature: string; publicKey?: string }): Promise<AuthSession>;
  session(): Promise<AuthSession | null>;
  logout(): Promise<void>;
}
export type FlowStep = 'choose' | 'connecting' | 'review' | 'address' | 'sign' | 'manual' | 'verifying' | 'connected' | 'error' | 'getwallet';
export interface GhostlinkSnapshot {
  open: boolean; step: FlowStep; busy: boolean; network: Network;
  walletId: string | null; account: WalletAccount | null;
  connection: 'disconnected' | 'connected' | 'manual';
  authentication: 'unauthenticated' | 'authenticating' | 'authenticated';
  session: AuthSession | null; challenge: AuthChallenge | null;
  balance: bigint | null; error: { code: ErrorCode; message: string } | null;
  revocationPending: boolean; wallets: readonly WalletDescriptor[];
  request: { title: string; message: string } | null;
}
export interface WalletDescriptor { id: string; name: string; kind: WalletAdapter['kind']; mark: string; icon?: string; installUrl: string; available: boolean; capabilities: WalletCapabilities; }
export interface GhostlinkConfig {
  app: { name: string; url: string; icon?: string }; network?: Network;
  adapters?: WalletAdapter[]; auth?: AuthTransport | { baseUrl?: string; fetch?: typeof fetch };
}
