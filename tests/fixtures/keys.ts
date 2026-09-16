import { createRequire } from 'node:module';
import type * as Kaspa from '../../packages/ghostlink-server/vendor/kaspa/kaspa.js';
// Public, valueless test keys. Never use these accounts with real funds.
export const sdk = createRequire(import.meta.url)('../../packages/ghostlink-server/vendor/kaspa/kaspa.js') as typeof Kaspa;
export const secret = '1'.padStart(64, '0');
export function keyAccount(secretHex = secret, network: 'mainnet' | 'testnet-10' | 'testnet-11' = 'testnet-11') {
  const key = new sdk.PrivateKey(secretHex); const pub = key.toPublicKey(); const native = pub.toAddress(network);
  const result = { address: native.toString(), publicKey: pub.toString(), network };
  native.free(); pub.free(); key.free(); return result;
}
export const account = keyAccount();
export const sign = (message: string, privateKey = secret) => sdk.signMessage({ message, privateKey, noAuxRand: true });
