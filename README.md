# Ghostlink

Kaspa wallet login for TypeScript applications, with native Vue and React UI and a Node verification backend. Connect the KasWare or Kastle browser extension. Authentication is established by the backend, independently from live wallet connectivity.

Mobile and hardware options are hidden from the default UI while their UX and security are evaluated. See the [deferred integration findings](docs/roadmap/wallet-integrations.md) for Kaspire, Ledger and KSPR. Kaspium manual signing remains an [explicit SDK opt-in](docs/integration/kaspium.md).

This is a **pre-release implementation**. Source-backed adapters and automated fixtures are included; real-wallet version certification and testnet transaction evidence are tracked in [the compatibility record](docs/testing/compatibility-v1.json). Registry publication is separate.

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

Install `ghostlink-core` and `ghostlink-vue` from the prepared tarballs, alongside Vue 3.5+. Set up the server below first.

```ts
import { createApp } from 'vue';
import { createGhostlink } from 'ghostlink-core';
import { GhostlinkPlugin } from 'ghostlink-vue';
import 'ghostlink-core/styles.css';
import 'ghostlink-core/fonts.css';
import App from './App.vue';

const client = createGhostlink({
  app: { name: 'Your dApp', url: 'https://app.example' },
  network: 'testnet-11',
  auth: { baseUrl: '/auth/ghostlink' },
});
createApp(App).use(GhostlinkPlugin, client).mount('#app');
// Call client.destroy() when disposing the application/controller.
```

```vue
<script setup lang="ts">
import { GhostlinkConnectButton, GhostlinkModal } from 'ghostlink-vue';
</script>
<template>
  <GhostlinkConnectButton />
  <GhostlinkModal />
</template>
```

`useGhostlink()` returns `{ client, snapshot }`; Vue's snapshot is a readonly shallow ref. `GhostlinkProvider` is an alternative to the app plugin. Render one modal host per controller.

## React

```tsx
import { createGhostlink } from 'ghostlink-core';
import { GhostlinkProvider, GhostlinkConnectButton, GhostlinkModal } from 'ghostlink-react';
import 'ghostlink-core/styles.css';
import 'ghostlink-core/fonts.css';

const client = createGhostlink({ app: { name: 'Your dApp', url: 'https://app.example' } });
export function WalletLogin() {
  return <GhostlinkProvider client={client}>
    <GhostlinkConnectButton />
    <GhostlinkModal />
  </GhostlinkProvider>;
}
```

Create a controller per application instance/request boundary rather than sharing authenticated SSR state across users. Imports and construction are SSR safe; discovery and lifecycle listeners start in the browser. `useGhostlink()` returns the reactive snapshot and client. Dispose a controller when its owning application is unmounted, not during incidental component rerenders.

## Verification server

```ts
import { createServer } from 'node:http';
import { createGhostlinkServer, createSqliteStorage, createNodeHandler } from 'ghostlink-server';

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

`connect()` opens wallet selection; `connect(id)` connects a specific adapter. Call `authenticate()` to obtain and verify a login signature. The modal handles intermediate review; `prepareAuthentication(address?)` creates the manual or injected login challenge. `disconnect()` clears local state and requests server revocation; inspect `revocationPending` if offline. `restoreSession()` consults the server. `getSnapshot()`, `subscribe(listener)` and `destroy()` support headless integrations.

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
pnpm exec playwright install chromium
pnpm test:browser
pnpm check:package
```

`check:package` prepares local npm tarballs and verifies a clean consumer install, SSR rendering and packaged assets. No publication occurs. The React development harness is `/react.html`; the explicit Kaspium manual-signing harness is `/manual.html`. Both are available only under the Vite dev server and are not included in the example production build.

Further reading: [corrected specification](docs/design/ghostlink%20spec.md), [security model](docs/security/model.md), [authentication profile](docs/protocol/kaspa-authentication-profile-v1.md), [wallet adapters](docs/integration/wallet-adapters.md), [Kaspium walkthrough](docs/integration/kaspium.md), [theming](docs/integration/theming.md), [live acceptance procedure](docs/testing/live-wallets.md), [visual fidelity](docs/testing/visual-fidelity.md). The original design prototype is preserved under `docs/design/Ghostlink UI/`.
