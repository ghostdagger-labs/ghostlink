import { createRequire } from 'node:module';
import type * as Kaspa from '../vendor/kaspa/kaspa.js';
import { addressPrefix, accountId, GhostlinkError } from '@ghostdagger/ghostlink-core';
import type { Network } from '@ghostdagger/ghostlink-core';
const require = createRequire(import.meta.url);
// Kept external to the bundle; the unmodified official WASM release is distributed alongside it.
const kaspa = require('../vendor/kaspa/kaspa.js') as typeof Kaspa;
/** Validate a canonical Schnorr public-key address/checksum for the network with the official SDK. Returns identity and hex public key; throws INVALID_REQUEST for unsupported or invalid addresses. */
export function validateKaspaAddress(value: string, network: Network): { address: string; accountId: string; publicKey: string } {
  let address: Kaspa.Address | undefined; let key: Kaspa.XOnlyPublicKey | undefined;
  try {
    if (!kaspa.Address.validate(value)) throw new GhostlinkError('INVALID_REQUEST', 'The address checksum is invalid. Copy the full receiving address directly from your wallet.');
    address = new kaspa.Address(value);
    if (address.prefix !== addressPrefix(network) || address.toString() !== value) throw new GhostlinkError('INVALID_REQUEST', 'The address does not match the selected network or canonical address format.');
    if (address.version !== 'PubKey') throw new GhostlinkError('INVALID_REQUEST', 'This address type is not supported. Use a standard Schnorr public-key address.');
    key = kaspa.XOnlyPublicKey.fromAddress(address);
    return { address: value, accountId: accountId(value, network), publicKey: key.toString() };
  } catch (error) { if (error instanceof GhostlinkError) throw error; throw new GhostlinkError('INVALID_REQUEST', 'Enter a valid Schnorr public-key address for the selected network.'); }
  finally { key?.free(); address?.free(); }
}
/** Verify a 64-byte lowercase hex Schnorr signature against the exact message and address. Returns false on invalid input. Does not check challenge expiry, origin, replay, or application authorization; use createGhostlinkServer for login. */
export function verifyKaspaSignature(input: { address: string; network: Network; message: string; signature: string; publicKey?: string }): boolean {
  let publicKey: Kaspa.PublicKey | undefined; let derived: Kaspa.Address | undefined;
  try {
    const account = validateKaspaAddress(input.address, input.network);
    if (!/^[a-f0-9]{128}$/.test(input.signature)) return false;
    publicKey = new kaspa.PublicKey(input.publicKey ?? account.publicKey);
    derived = publicKey.toAddress(input.network);
    if (derived.toString() !== input.address) return false;
    return kaspa.verifyMessage({ message: input.message, signature: input.signature, publicKey });
  } catch { return false; }
  finally { derived?.free(); publicKey?.free(); }
}
