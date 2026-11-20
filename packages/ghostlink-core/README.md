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
const session = await client.authenticate(); // Verified readonly session.
// Dispose: unsubscribe(); client.destroy();
```

Use `ghostlink-server` to verify login and maintain the session. A connected provider alone is never authentication. Default adapters are the KasWare and Kastle browser wallets. Mobile and hardware options are hidden by default. Kaspium manual QR/paste signing remains available by explicitly passing `adapters: [...defaultAdapters(), kaspiumAdapter()]` (both functions are exported by this package). Capabilities are checked at runtime; they are not proof of wallet identity or real-wallet certification. Generic message signing does not provide wallet-side phishing resistance.

UI packages import `ghostlink-core/styles.css` and optional local `ghostlink-core/fonts.css`. Override scoped `--ghostlink-*` variables for branding. `createGhostlink` and imports are SSR safe. The client owns no keys and contains no server/WASM verifier code.

Verified authentication closes the modal by default. Set `closeOnAuthenticate: false` in `createGhostlink` to keep session details open. The account button or `client.open()` still opens details and sign-out on demand. This policy applies only to login completion, not later wallet requests.

For UI-driven flows, register `const unsubscribe = client.onAuthenticated(session => { /* continue your site's flow */ })` before opening the modal. The readonly session is delivered once per fresh, backend-verified login after `busy` is cleared. Connection, cancellation, rejection, verification failure, restoration and other wallet requests never emit this signal. Unsubscribe when the host flow unmounts; `destroy()` removes all listeners. Listener exceptions and rejected promises are reported to the console without failing authentication or blocking other listeners; listeners are not awaited. Headless callers can use the session returned by `authenticate()` instead. Use one completion mechanism per continuation to avoid running it twice.

`restoreSession()` preserves a valid backend login when the saved wallet is locked, initializing, or temporarily returns no account. The snapshot reports `authenticated` with `connection: 'disconnected'`, and wallet signing remains unavailable. A later restoration (including browser focus) can recover the same account without another login signature. A confirmed account/network mismatch or provider change event still revokes authentication; server expiry and explicit sign-out remain authoritative.

`signTransaction` accepts explicitly tagged native transaction JSON or PSKT JSON and never broadcasts. `sendTransaction` is a separate explicit wallet-approved transfer. Amounts are bigint sompi; use `parseKasAmount`/`formatKas` for decimal conversion. Calls throw typed `GhostlinkError` values and approvals are serialized. Kaspium manual login has no automated transaction capability.

Pre-release. See the repository's versioned compatibility record and security/profile documentation before deployment. Wallet assets and local fonts include their upstream licenses and provenance.
