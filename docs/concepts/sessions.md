---
description: "Understand the distinction between a connected wallet, a signed message, and an authenticated application session."
updated: '2026-11-23'
---
# Authentication and sessions

## The login flow

1. `connect(walletId)` asks the selected wallet for an account on the configured network.
2. `prepareAuthentication()` obtains a browser-bound, single-use challenge from your backend.
3. The user reviews the application, network, account, and exact message.
4. `authenticate()` requests the signature and submits it for server verification.
5. The backend validates the message and signature, then issues an HttpOnly session cookie.

The supplied modal manages these steps. A headless integration must present the review itself. `authenticate()` creates a challenge if one is not already prepared.

## Connection is not authentication

`snapshot.connection` describes provider connectivity: disconnected, connected, or manual. `snapshot.session` contains server-verified identity metadata. A restored session can remain authenticated even when no live wallet is connected.

Never authorize from a wallet's address, a successful signature call, or localStorage. A protected backend handler uses `auth.getSession(request)` and then applies the application's permissions.

## Session shape

| Field | Meaning |
| --- | --- |
| `accountId` | Network-qualified identifier for application user lookup |
| `address` | Verified full Kaspa address |
| `network` / `chainId` | Authenticated network and its `kaspa:` chain identifier |
| `issuedAt` | Verification time, ISO 8601 UTC |
| `expiresAt` | Absolute expiration, ISO 8601 UTC |
| `idleExpiresAt` | Last-known idle expiration; protected reads can extend activity |

The browser receives metadata, not a session bearer token. Opaque cookie tokens are hashed in server storage.

## Readiness and restoration

Providers automatically attach the client on mount. Identity is unresolved while `initialization` is idle or restoring. Once ready, a null session means signed out. On error, show retry feedback even if a previous session remains visible.

`restoreSession()` rechecks the backend without a new signature. It does not fire `onAuthenticated()`. Use that listener for fresh-login navigation or other continuations; its returned promises are not awaited, so handle asynchronous failures inside your listener.

## Expiry and logout

The default challenge lifetime is five minutes. Sessions default to 24 hours absolute and 30 minutes idle. Successful `getSession()` calls update idle activity, capped at absolute expiry; configuration can change these lifetimes.

`disconnect()` clears local state and requests server revocation. If the backend cannot be reached, `revocationPending` stays true and attached clients retry. Local sign-out alone does not prove that the server revoked the session.

> [!WARNING]
> Closing a wallet prompt cannot undo a submitted transfer. Closing the Ghostlink dialog invalidates pending local work but cannot force an extension's own prompt to close.

## Security boundaries

Generic message signing does not provide wallet-side phishing resistance. Ghostlink's server validates the exact audience, message, account, network, expiry, and signature; that does not establish native wallet origin enforcement.

Read the [security model](../security/model.md), [authentication profile](../protocol/kaspa-authentication-profile-v1.md), and [lifecycle guide](../integration/lifecycle.md) for the full contracts.
