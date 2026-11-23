# Ghostlink

Kaspa wallet login for TypeScript applications, with native Vue and React UI and a Node verification backend. Connect the KasWare or Kastle browser extension. Authentication is established by the backend, independently from live wallet connectivity.

Mobile and hardware options are hidden from the default UI while their UX and security are evaluated. See the [deferred integration findings](docs/roadmap/wallet-integrations.md) for Kaspire, Ledger and KSPR. Kaspium manual signing remains an [explicit SDK opt-in](docs/integration/kaspium.md).

This source targets **beta release `0.1.0-beta.2`** under `@ghostdagger`. Install matching versions using `@beta` or the exact version. npm's `latest` tag remains on the initial `0.1.0-beta.1`; use `@beta` or `@0.1.0-beta.2` for the Postgres update. Source-backed adapters and automated fixtures are included; real-wallet version certification and testnet transaction evidence are tracked in [the compatibility record](docs/testing/compatibility-v1.json). See [release setup and publishing](docs/releases/publishing.md) for GitHub Actions, npm ownership and remaining release prerequisites.

## Integration guides

Start with the complete [Vue integration guide](docs/integration/vue.md) or [React integration guide](docs/integration/react.md). Each includes copyable app files, a Node backend, local package installation, login, protected requests, session restoration, logout, and deployment notes. Read the [provider lifecycle and SSR contract](docs/integration/lifecycle.md) when adapting an existing app.

For serverless deployments, use the [Postgres/Neon storage guide](docs/integration/postgres.md) and [complete Vercel + Neon example](examples/vercel-neon/README.md). Starting with `0.1.0-beta.2`, the server package includes a Postgres adapter with the same revocation and single-use challenge guarantees as SQLite, without requiring a persistent function filesystem.

## Website

The Nuxt landing page and same-origin demo live in `website/`. After installing and building, run `pnpm dev:website` and open http://127.0.0.1:3000. `docker compose up --build -d` runs the production website with persistent SQLite. See [website setup](website/README.md) and the [landing-page reconciliation roadmap](docs/roadmap/landing-page-reconciliation.md).

## Run the Vue showcase

Use Node 24 and pnpm 11.7.0.

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm dev
```

Open http://127.0.0.1:5173 in the browser where your wallet is installed. Select Testnet 11 for KasWare or Testnet 10 for Kastle in both the application and wallet. Mainnet is also available for login. Login requires no funds. The backend uses SQLite under `examples/vue/.data/`. The example also includes an explicit transfer form and signing-only payload input; only approve transactions you intend to send. Test fixtures never submit mainnet transactions.

To serve the production build locally with the same Node process, use `pnpm --filter ghostlink-example-vue start` and open http://127.0.0.1:5174. Configure `GHOSTLINK_ORIGIN`, `PORT`, and `GHOSTLINK_DATABASE` for your environment. The sample listens on loopback. A deployed HTTPS reverse proxy must preserve the configured Host.

## Minimal Vue setup

Install `@ghostdagger/ghostlink-core@0.1.0-beta.2` and `@ghostdagger/ghostlink-vue@0.1.0-beta.2`, alongside Vue 3.5+. Set up the server below first.

```ts
import { createApp } from 'vue';
import { createGhostlink } from '@ghostdagger/ghostlink-core';
import { GhostlinkPlugin } from '@ghostdagger/ghostlink-vue';
import '@ghostdagger/ghostlink-core/styles.css';
import '@ghostdagger/ghostlink-core/fonts.css';
import App from './App.vue';

const client = createGhostlink({
  app: { name: 'Your dApp', url: 'https://app.example' },
  network: 'testnet-11',
  auth: { baseUrl: '/auth/ghostlink' },
});
createApp(App).use(GhostlinkPlugin, client).mount('#app');
// The plugin initializes on app mount and releases browser activity on app unmount.
```

```vue
<script setup lang="ts">
import { GhostlinkConnectButton, GhostlinkModal } from '@ghostdagger/ghostlink-vue';
</script>
<template>
  <GhostlinkConnectButton />
  <GhostlinkModal />
</template>
```

`useGhostlink()` returns `{ client, snapshot }`; Vue's snapshot is a readonly shallow ref. `GhostlinkProvider` is an alternative to the app plugin. Render one modal host per controller.

## React

```tsx
import { useState } from 'react';
import { createGhostlink } from '@ghostdagger/ghostlink-core';
import { GhostlinkProvider, GhostlinkConnectButton, GhostlinkModal } from '@ghostdagger/ghostlink-react';
import '@ghostdagger/ghostlink-core/styles.css';
import '@ghostdagger/ghostlink-core/fonts.css';

export function WalletLogin() {
  const [client] = useState(() => createGhostlink({ app: { name: 'Your dApp', url: 'https://app.example' } }));
  return <GhostlinkProvider client={client}>
    <GhostlinkConnectButton />
    <GhostlinkModal />
  </GhostlinkProvider>;
}
```

Keep a stable client per provider lifetime and a separate client per SSR request. Construction and server rendering are passive. The provider initializes after browser mounting, including when using only hooks and custom UI, and releases its attachment on cleanup. It never destroys the supplied client or signs out an established session. React Strict Mode cleanup is reversible. Use a keyed provider remount to replace a client; reserve `destroy()` for permanently retiring an instance, outside reusable effect cleanup.

`useGhostlink()` returns the reactive snapshot and client. Gate identity-dependent UI on `snapshot.initialization === 'ready'` (Vue script uses `snapshot.value`). `idle` and `restoring` are unresolved; `error` exposes `initializationError`, with retry through `client.restoreSession()`. A retained session alone does not establish readiness. See [lifecycle, ownership and SSR](docs/integration/lifecycle.md) for the full contract and headless setup.

## Verification server

```ts
import { createServer } from 'node:http';
import { createGhostlinkServer, createSqliteStorage, createNodeHandler } from '@ghostdagger/ghostlink-server';

const storage = createSqliteStorage('./data/ghostlink.sqlite');
const auth = createGhostlinkServer({
  origin: 'https://app.example',
  loginUri: 'https://app.example/login',
  networks: ['testnet-11'],
  storage,
});
createServer(createNodeHandler(auth)).listen(3000, '127.0.0.1');
// Route /auth/ghostlink/* from your HTTPS app to this server, preserving Host.
// For your own protected Web handler: await auth.getSession(request).
// Close storage during graceful server shutdown.
```

Frameworks using Web requests can call `auth.handle(request, { ip: trustedPeerAddress })` directly. The Node adapter extracts the socket peer, never an arbitrary forwarded header. Protected application mutations still need your application's own CSRF and authorization checks.

## Client operations

`connect()` opens wallet selection; `connect(id)` connects a specific adapter. Call `authenticate()` to obtain and verify a login signature; its promise returns the verified session. The modal handles intermediate review; `prepareAuthentication(address?)` creates the manual or injected login challenge. `disconnect()` clears local state and requests server revocation; inspect `revocationPending` if offline. `restoreSession()` consults the server. `getSnapshot()`, `subscribe(listener)` and `attach()` support headless integrations. A headless owner releases the function returned by `attach()` when finished; `destroy()` permanently retires the client.

### Authentication completion

Successful authentication closes the modal by default in Vue and React, including explicit manual signing. The connect button becomes an account button; clicking it reopens session details and sign-out. Set `closeOnAuthenticate: false` when creating the controller to keep details open after login instead. This option applies to authentication completion, not subsequent wallet requests.

Register a completion listener before opening the modal to resume your site's flow:

```ts
const client = createGhostlink({
  app: { name: 'Your dApp', url: 'https://app.example' },
  closeOnAuthenticate: true, // Default; false keeps session details open.
});
const unsubscribe = client.onAuthenticated(session => {
  // Resume your checkout or other application flow using session.address.
});
client.open();
// Call unsubscribe() when the host flow unmounts; destroy() also removes listeners.
```

`onAuthenticated` fires once per successful fresh login, only after backend verification and after the operation lock is released. It does not fire for connection approval, cancellation, rejection, failed verification, session restoration, account details, or other wallet requests. Each listener receives a readonly session. Synchronous and asynchronous listener failures are reported to the console without changing authentication or blocking other listeners; listener promises are not awaited. The host owns navigation, continuation, and error handling. Payment still requires a separate explicit wallet approval.

Headless callers can instead use `const session = await client.authenticate()`. Choose either that result or the completion listener to advance a given flow, so it runs once. Observe `subscribe()` / the framework snapshot for ordinary session restoration and sign-out changes. The example's **Test sign** and **Refresh balance** controls live in its Wallet requests panel, outside the reusable account details UI.

After verified login and a live connection:

```ts
await client.signMessage('An application message to review');
await client.signTransaction({
  format: 'pskt-json', // KasWare; Kastle uses kaspa-transaction-json
  payload: serializedPskt,
  network: 'testnet-11',
  address: client.getSnapshot().session!.address,
}); // returns signed data; never broadcasts
await client.sendTransaction({ toAddress, amountSompi: 100_000_000n, priorityFeeSompi: 0n });
// A wallet-approved transfer returns its transaction ID.
```

Use `parseKasAmount()` and `formatKas()` for exact decimal conversion. Capabilities determine available operations. All approval calls are serialized and throw typed `GhostlinkError` values; catch errors around custom triggers. Kaspium manual authentication does not enable automated wallet requests.

## Checks and packages

```sh
pnpm build
pnpm typecheck
pnpm test
pnpm test:release
pnpm exec playwright install chromium
pnpm test:browser
pnpm check:package --manager both
pnpm check:guides
pnpm release:dry-run
```

`check:guides` extracts the documented Vue and React apps into temporary directories, installs the tarballs from `check:package`, typechecks and builds both apps, and runs browser flows through development proxies and production servers. CI runs the same check to catch documentation drift.

`check:package` prepares local npm tarballs with a release manifest and verifies clean npm/pnpm consumer installs, SSR rendering and packaged assets. `--artifacts artifacts` tests existing archives without repacking; `release:dry-run` checks npm publication without sending packages. The [publishing guide](docs/releases/publishing.md) covers the first-publish bootstrap and later OIDC releases. The React development harness is `/react.html`; the explicit Kaspium manual-signing harness is `/manual.html`; `/lifecycle.html` tests hook-only provider ownership and hydration. These harnesses are available only under the Vite dev server and are not included in the example production build.

Ghostlink's original code is [MIT licensed](LICENSE). Bundled fonts, wallet logos and Kaspa WASM retain their own terms; see [third-party notices](THIRD_PARTY_NOTICES.md).

Further reading: [corrected specification](docs/design/ghostlink%20spec.md), [security model](docs/security/model.md), [authentication profile](docs/protocol/kaspa-authentication-profile-v1.md), [wallet adapters](docs/integration/wallet-adapters.md), [Kaspium walkthrough](docs/integration/kaspium.md), [theming](docs/integration/theming.md), [live acceptance procedure](docs/testing/live-wallets.md), [visual fidelity](docs/testing/visual-fidelity.md). The original design prototype is preserved under `docs/design/Ghostlink UI/`.
