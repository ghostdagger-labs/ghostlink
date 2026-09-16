# ghostlink-core

Framework-neutral Kaspa wallet login controller, compatibility adapters, authentication client and shared presentation assets.

```ts
import { createGhostlink } from 'ghostlink-core';
const client = createGhostlink({
  app: { name: 'Your dApp', url: 'https://app.example' },
  network: 'testnet-11',
  auth: { baseUrl: '/auth/ghostlink' },
});
const unsubscribe = client.subscribe(() => console.log(client.getSnapshot()));
await client.connect('kasware');
await client.authenticate();
// Dispose: unsubscribe(); client.destroy();
```

Use `ghostlink-server` to verify login and maintain the session. A connected provider alone is never authentication. Default adapters are KasWare, Kastle, and Kaspium manual QR/paste signing. Capabilities are checked at runtime; they are not proof of wallet identity or real-wallet certification. Generic message signing does not provide wallet-side phishing resistance.

UI packages import `ghostlink-core/styles.css` and optional local `ghostlink-core/fonts.css`. Override scoped `--ghostlink-*` variables for branding. `createGhostlink` and imports are SSR safe. The client owns no keys and contains no server/WASM verifier code.

`restoreSession()` preserves a valid backend login when the saved wallet is locked, initializing, or temporarily returns no account. The snapshot reports `authenticated` with `connection: 'disconnected'`, and wallet signing remains unavailable. A later restoration (including browser focus) can recover the same account without another login signature. A confirmed account/network mismatch or provider change event still revokes authentication; server expiry and explicit sign-out remain authoritative.

`signTransaction` accepts explicitly tagged native transaction JSON or PSKT JSON and never broadcasts. `sendTransaction` is a separate explicit wallet-approved transfer. Amounts are bigint sompi; use `parseKasAmount`/`formatKas` for decimal conversion. Calls throw typed `GhostlinkError` values and approvals are serialized. Kaspium manual login has no automated transaction capability.

Pre-release. See the repository's versioned compatibility record and security/profile documentation before deployment. Wallet assets and local fonts include their upstream licenses and provenance.
