# @ghostdagger/ghostlink-server

Node 24 authentication verification, Web handlers, Node HTTP adapter and durable SQLite sessions for Ghostlink.

```ts
import { createGhostlinkServer, createSqliteStorage, createNodeHandler } from '@ghostdagger/ghostlink-server';
const storage = createSqliteStorage('./data/auth.sqlite');
const auth = createGhostlinkServer({
  origin: 'https://app.example', loginUri: 'https://app.example/login',
  networks: ['testnet-11'], storage,
});
// Web: await auth.handle(request, { ip: trustedPeerAddress });
// Node: createServer(createNodeHandler(auth)).listen(...);
// Protected route: await auth.getSession(request);
// Shutdown: storage.close();
```

Mount `/auth/ghostlink/{session,challenge,verify,logout}` on the same origin. The Node adapter validates Host and uses the socket peer for rate limits. Reverse proxies must preserve the trusted host. `getSession` supplies identity, not application authorization or CSRF protection for your own mutations.

Defaults: five-minute browser-bound single-use challenges, official Kaspa Schnorr/address checks, 24-hour absolute / 30-minute idle sessions, hashed opaque tokens, HttpOnly/Secure/SameSite=Lax host cookies, CSRF, origin checks, 16-KiB body limit, and persistent rate limits. HTTP requires explicit `allowInsecureLocalhost: true` and a loopback origin. No edge-runtime support.

Only standard Schnorr public-key addresses are accepted. Keys can be extracted from those addresses for manual Kaspium login. Server verification prevents replay and enforces the intended message/account/network, but generic message signing is not phishing-resistant. The profile is proposed; no CACAO interoperability or independent audit is claimed.

The official rusty-kaspa v2.0.1 Node WASM artifact is packaged unmodified with its ISC license and `vendor/provenance.json` checksums. Do not replace it with a similarly named unofficial npm package. New storage adapters must satisfy `GhostlinkStorage` and `assertStorageConformance` against an empty isolated test store, particularly atomic challenge consumption and session revocation.

Pre-release. See the repository's security and live-wallet acceptance documentation before deployment.
