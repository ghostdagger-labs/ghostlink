---
description: "The proposed canonical Kaspa login-message format, cryptographic checks, and interoperability boundaries."
updated: '2026-11-23'
---
# Ghostlink Kaspa authentication profile v1

Status: **proposed application profile**, September 16, 2026. This is not a registered CAIP namespace or an interoperable CACAO profile. It adopts the account/chain separation and audience binding of [CAIP-122](https://standards.chainagnostic.org/CAIPs/caip-122). Generic wallet message signing does not implement that standard's wallet-side domain checks.

## Identifiers

| Network | Proposed CAIP-2 chain | Native address prefix |
| --- | --- | --- |
| Mainnet | `kaspa:mainnet` | `kaspa:` |
| Testnet 10 | `kaspa:testnet-10` | `kaspatest:` |
| Testnet 11 | `kaspa:testnet-11` | `kaspatest:` |

The CAIP-10 account is `<chain>:<prefixless address segment>`, for example `kaspa:testnet-11:qpum…`. A native address is a separate value, `kaspatest:qpum…`. Restore the native prefix from the explicit chain mapping before validating with the official SDK. Testnet address prefixes do **not** distinguish testnet versions: the signed chain field supplies that binding. Reject other networks. Do not infer a testnet version solely from `kaspatest:`. Testnet 10 and 11 have distinct signed chain IDs and must never be substituted for each other.

Manual address input may contain grouping spaces or line breaks; the client removes whitespace before requesting a challenge. It never removes bytes from an issued message. Only standard Schnorr public-key addresses are accepted in v1. Validate the checksum, canonical lower-case encoding, network prefix, and `PubKey` address version. Script-hash, ECDSA, multisig and other account types require a future profile; they must fail closed today.

## Exact serialization

`serializeLoginMessage` is the canonical writer; `parseLoginMessage` is its strict inverse with trusted-origin/network/time checks. The string is signed as UTF-8, with LF separators, exactly one blank line around the fixed statement and **no final newline**. No Unicode normalization, trimming, field reordering, or HTML escaping is applied to the signed bytes. Nonce is 32 cryptographically random bytes encoded as 64 lower-case hex characters.

```text
app.example wants you to sign in with your Kaspa account:
<prefixless native address segment>

Sign in to this application. This signature does not authorize a transaction.

URI: https://app.example/login
Version: 1
Nonce: <64 lower-case hexadecimal characters>
Issued At: 2026-09-16T12:00:00.000Z
Expiration Time: 2026-09-16T12:05:00.000Z
Chain ID: kaspa:testnet-11
Request ID: ghostlink-kaspa-v1
```

The domain includes a nondefault port. URI is a canonical absolute HTTP(S) URL with no credentials or fragment and the exact trusted origin. Production requires HTTPS. Timestamps are UTC ISO strings with three fractional digits. Lifetime is positive and at most five minutes. Expiry is a hard deadline, including at atomic consumption; the 30-second skew allowance applies only to future `Issued At`. Messages fit Kaspium's 2,000-character input limit; reject oversize messages instead of truncating. The fixed ASCII fields and URL serialization keep generated login messages ASCII.

## Cryptography

Use the official [rusty-kaspa v2.0.1 SDK](https://github.com/kaspanet/rusty-kaspa/releases/tag/v2.0.1), including its personal-message hash and Schnorr verifier. Do not sign a raw SHA digest or a Bitcoin/Ethereum-prefixed message. `@ghostdagger/ghostlink-server` packages the unmodified Node WASM artifact, license, and checksum manifest in `vendor/`. Archive SHA-256: `7eaffac9cd920ef2fdf540c6e10f2a2b7761170ebc62ec57dfa0f71c64567a71`.

Return signatures as 64-byte Schnorr values encoded in 128 lower-case hex characters. Client compatibility boundaries accept upper-case hex and optional `0x` and normalize before HTTP submission. The HTTP verifier accepts only the canonical encoding. An optional key is x-only (32 bytes) or compressed (33 bytes); derive its native address and compare to the challenged account. For manual signing, `XOnlyPublicKey.fromAddress` obtains the verification key without key export. A cryptographically valid signature from a different key is invalid for this login.

## Verification and receipts

The server stores the exact message and challenge, bound to a browser cookie. A verification request supplies challenge ID, exact message, signature, and optionally public key. Validate application origin, CSRF, browser binding, challenge validity, exact stored bytes, account type, key/address correspondence, and signature. Atomically consume the challenge and create the session. An already consumed or concurrently consumed challenge fails. A newer challenge replaces the previous pending challenge for that browser.

Store a versioned receipt containing `profile: ghostlink-kaspa-v1`, exact message, signature and optional submitted public key. This is an internal authentication receipt, **not CACAO** and not a claim of independent security audit. The browser receives an opaque session cookie, not a signed authentication token or private key.

## Stronger wallet integrations

A CAIP-122-aligned wallet must parse these fields and compare the signed domain/URI against the actual requesting origin supplied by its trusted browser transport. Reading the domain out of the message and comparing it with itself provides no protection. Expired, malformed, mismatched domain/account/network requests must be rejected before signing.

Adapters exposing `authentication: 'caip122'` must implement `signIn`. Ghostlink uses that route exclusively. Rejection, parse errors, mismatched returned messages, or failed verification must never cause a retry through generic `signMessage`. Capability metadata and provider/version strings can be forged; none proves wallet identity.

When an ecosystem namespace/profile is registered, introduce a new profile identifier and fixtures. Issue new challenges using the new profile. If migration requires a grace period, maintain explicit allowlisted readers and disjoint serializers, and keep receipts tagged with the original profile. Never silently reinterpret old account IDs or signed bytes. An explicit compatibility configuration may continue issuing v1 challenges for existing wallets.

Fixtures: [canonical login](../../tests/fixtures/login-v1.json). Conformance checks: `protocol.test.ts`, `crypto.test.ts`, `controller.test.ts`, and [wallet integration requirements](../integration/wallet-adapters.md).
