---
description: "Handle expected wallet outcomes, distinguish initialization failures, and diagnose origin, network, and deployment issues."
updated: '2026-11-23'
---
# Errors and troubleshooting

## Typed failures

`GhostlinkError` extends Error and carries a string `code`. Its `message` is displayable; there is no separate `userMessage` property or exported `isGhostlinkError` helper.

| Code | Meaning / recovery |
| --- | --- |
| `USER_REJECTED` | User declined; let them retry deliberately |
| `UNAVAILABLE` | Wallet/provider unavailable; install, unlock, or reconnect |
| `UNSUPPORTED` | Missing capability, format, or supported wallet route; offer supported actions |
| `NETWORK_MISMATCH` | Choose the same supported network in app, wallet, and backend |
| `ACCOUNT_CHANGED` | Identity changed during the flow; reconnect and authenticate |
| `BUSY` | Another approval is outstanding; wait for it to settle |
| `CANCELLED` | Lifecycle/request cancelled or instance retired; do not revive stale results |
| `EXPIRED` | Challenge expired; prepare a new one and obtain a new signature |
| `INVALID_SIGNATURE` | Signature did not validate; keep the exact challenge/account and retry deliberately |
| `SERVER_ERROR` | Verification/transport failure; show recovery without granting access |
| `INVALID_REQUEST` | Invalid input, origin, address, or configuration; inspect the stated message |
| `UNAUTHENTICATED` | No valid application session; complete login |

<!-- docs-check: errors.ts -->
```ts
import { GhostlinkError, type Ghostlink } from '@ghostdagger/ghostlink-core';

export async function signIn(client: Ghostlink): Promise<string | null> {
  try {
    await client.connect('kasware');
    await client.authenticate();
    return null;
  } catch (error) {
    if (error instanceof GhostlinkError) {
      if (error.code === 'USER_REJECTED' || error.code === 'CANCELLED') return null;
      return error.message;
    }
    return 'Could not complete sign-in. Please try again.';
  }
}
```

This helper demonstrates error handling; use the supplied modal or an explicit reviewed headless flow for your application UI.

## Session checks are separate

`snapshot.initializationError` describes restoration failure; `snapshot.error` describes wallet-operation failure. A failed session check must not redirect the user as though signed out. Show retry and call `restoreSession()` again.

## Login service unavailable

Check the browser network response for `/auth/ghostlink/session`. An HTML response usually means a route or proxy returned the frontend fallback instead of JSON. Confirm the Node backend is running and routes preserve cookies.

On serverless hosts, verify shared storage, migration state, server-only credentials, Node 24, and the bundled Kaspa loader/WASM. Do not change to permissive authentication when storage is unavailable.

## Origin or CSRF rejection

Use the exact configured scheme, hostname, and port. `localhost` and `127.0.0.1` are different origins. Public deployments require HTTPS. Match `app.url`, server origin, login URI, and the browser's URL.

Preserve Host through trusted proxies. Let the default auth transport bootstrap CSRF with the session endpoint. Separate domains are not a drop-in replacement for this same-origin cookie flow.

## Network mismatch

The client defaults to Testnet 11. The complete Vue/React walkthroughs use Testnet 10 to support both default wallets. Check the app selector, wallet, and backend allowlist together. Kastle's Testnet 11 route is deliberately rejected based on recorded wallet failure.

## Session remains visible after a failed check

That is last-known state. Gate identity on `initialization === 'ready'`. Protected handlers must check their own current request; client rendering never replaces server authorization.

## Sign-out while offline

Show `revocationPending` and explain that server revocation is unconfirmed. Attached clients retry on lifecycle/connectivity events. A new login waits for revocation to succeed. Do not claim that a copied cookie was revoked merely because the local UI cleared.

## SSR, provider, or style issues

- Create a client in request/component scope, never in a shared server module.
- Keep its identity stable for the provider lifetime; deliberately replace it with a keyed remount.
- Import `styles.css` once and optionally `fonts.css`.
- Pass theme variables to the modal as well as the button.
- Keep one modal host per controller. Clean up subscriptions and attachments; reserve `destroy()` for permanent retirement.

See [Provider lifecycle](../integration/lifecycle.md), [Theming](../integration/theming.md), and your framework's complete integration guide.
