# Integrate Ghostlink with Vue

Build a small Vue + TypeScript app with wallet login, a protected Node endpoint, automatic session restoration, and logout. This is a complete browser-rendered Vite app: every file below can be copied as written. It uses the public packages, including their CSS, and a persistent SQLite backend.

Already have an app? Use the [backend](#serverindexts), [client integration](#client-integration), and [lifecycle notes](#lifecycle-and-ssr) with your existing build setup. The backend and browser must agree on the public origin and network.

## 1. Create the app

Use **Node 24** and **pnpm 11.7.0**. These files target the planned public npm release **0.1.0-beta.1**. Registry installation becomes available after that release is published; release preparation alone does not publish it.

```sh
mkdir my-ghostlink-vue
cd my-ghostlink-vue
mkdir -p src server
```

Save the following files, then run `pnpm install`. Public `@ghostdagger` packages use npm's default registry and require no GitHub token or custom registry configuration. Pin the matching core, server and UI versions together. Maintainers can test these guides before publication with `pnpm check:package` followed by `pnpm check:guides`; the checker substitutes the verified local archives only for dependency resolution.

## 2. Configure the app

### `package.json`

<!-- guide-file: package.json -->
```json
{
  "name": "my-ghostlink-vue",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@11.7.0",
  "engines": {
    "node": ">=24 <25"
  },
  "scripts": {
    "dev": "vite",
    "dev:server": "node --watch server/index.ts",
    "typecheck": "vue-tsc --noEmit",
    "build": "pnpm typecheck && vite build",
    "start": "node server/index.ts"
  },
  "dependencies": {
    "@ghostdagger/ghostlink-core": "0.1.0-beta.1",
    "@ghostdagger/ghostlink-vue": "0.1.0-beta.1",
    "@ghostdagger/ghostlink-server": "0.1.0-beta.1",
    "sirv": "^3.0.1",
    "vue": "^3.5.0"
  },
  "devDependencies": {
    "@types/node": "^24.0.0",
    "typescript": "~5.9.3",
    "vite": "^7.3.0",
    "@vitejs/plugin-vue": "^6.0.0",
    "vue-tsc": "^3.0.0"
  }
}
```

### `pnpm-workspace.yaml`

<!-- guide-file: pnpm-workspace.yaml -->
```yaml
packages: []

allowBuilds:
  esbuild: true
```

### `tsconfig.json`

<!-- guide-file: tsconfig.json -->
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": [
      "ES2022",
      "DOM",
      "DOM.Iterable"
    ],
    "strict": true,
    "noEmit": true,
    "skipLibCheck": false,
    "verbatimModuleSyntax": true,
    "erasableSyntaxOnly": true,
    "types": [
      "vite/client",
      "node"
    ]
  },
  "include": [
    "src",
    "server",
    "vite.config.ts"
  ]
}
```

### `vite.config.ts`

<!-- guide-file: vite.config.ts -->
```ts
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

const target = process.env.GHOSTLINK_API_ORIGIN ?? 'http://127.0.0.1:5174';
export default defineConfig({
  plugins: [vue()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      '/auth/ghostlink': { target, changeOrigin: false },
      '/api': { target, changeOrigin: false },
    },
  },
});
```

The browser uses relative URLs for both authentication and protected requests. The [Vite development proxy](https://vite.dev/config/server-options#server-proxy) sends them to the Node backend. Keep `changeOrigin: false` so the backend sees the browser's original Host. `strictPort` prevents a silent port change from invalidating the configured origin.

### `index.html`

<!-- guide-file: index.html -->
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>My Vue app</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

### `.gitignore`

<!-- guide-file: .gitignore -->
```gitignore
node_modules/
dist/
.data/
.env
```

## 3. Add the backend

This server handles Ghostlink's challenge, verification, session, and logout routes under `/auth/ghostlink`. It also owns `/api/private` and serves the built frontend in production. The SQLite file is created automatically. Keep `@ghostdagger/ghostlink-server` imports in server files only.

The source runs directly with [Node 24's TypeScript support](https://nodejs.org/docs/latest-v24.x/api/typescript.html#type-stripping); `pnpm typecheck` checks types separately. Run commands from the app root so the `dist` and `.data` paths resolve correctly.

### `server/index.ts`

<!-- guide-file: server/index.ts -->
```ts
import { createServer } from 'node:http';
import type { ServerResponse } from 'node:http';
import { existsSync } from 'node:fs';
import sirv from 'sirv';
import { createGhostlinkServer, createNodeHandler, createSqliteStorage } from '@ghostdagger/ghostlink-server';

const port = Number(process.env.PORT ?? 5174);
const origin = process.env.GHOSTLINK_ORIGIN ?? 'http://127.0.0.1:5173';
const storage = createSqliteStorage(process.env.GHOSTLINK_DATABASE ?? '.data/ghostlink.sqlite');
const auth = createGhostlinkServer({
  origin,
  loginUri: `${origin}/`,
  networks: ['testnet-10'],
  storage,
  allowInsecureLocalhost: true, // HTTP is allowed only on loopback; HTTPS elsewhere.
});
const handleAuth = createNodeHandler(auth);
const serve = existsSync('dist/index.html') ? sirv('dist', { single: true }) : null;

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

const server = createServer((req, res) => {
  void (async () => {
    if (req.url?.startsWith('/auth/ghostlink/')) {
      await handleAuth(req, res);
      return;
    }
    if (req.url?.split('?')[0] === '/api/private') {
      if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        json(res, 405, { error: 'Use GET.' });
        return;
      }
      if (req.headers.host !== new URL(origin).host ||
          req.headers['sec-fetch-site'] === 'cross-site' ||
          (req.headers.origin && req.headers.origin !== origin)) {
        json(res, 403, { error: 'Use the configured application origin.' });
        return;
      }
      const request = new Request(`${origin}/api/private`, {
        headers: { cookie: req.headers.cookie ?? '' },
      });
      const session = await auth.getSession(request);
      if (!session) {
        json(res, 401, { error: 'Sign in first.' });
        return;
      }
      json(res, 200, {
        message: 'Your protected backend request succeeded.',
        accountId: session.accountId,
      });
      return;
    }
    if (req.url?.startsWith('/api/') || req.url?.startsWith('/auth/')) {
      json(res, 404, { error: 'Unknown endpoint.' });
      return;
    }
    if (serve) serve(req, res);
    else json(res, 404, { error: 'Open the Vite frontend, or run pnpm build first.' });
  })().catch(error => {
    console.error(error);
    if (!res.headersSent) json(res, 500, { error: 'Server request failed.' });
    else res.destroy();
  });
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Backend on port ${port}; application origin ${origin}`);
});
function close() {
  server.close(() => { storage.close?.(); });
}
process.once('SIGINT', close);
process.once('SIGTERM', close);
```

`getSession(request)` checks the server session using its HttpOnly cookie. The browser never supplies a trusted account ID or stores a session token in JavaScript. Use the verified `session.accountId` to look up your own user and permissions. This read-only endpoint demonstrates authentication; add your application's authorization and CSRF protection before introducing state-changing endpoints. Ghostlink's authentication routes already handle their own CSRF checks.

## Client integration

### 4. Install the Vue plugin once

The plugin owns initialization and cleanup for the mounted app. Components only consume the client; do not call `attach()` or add a second restore-on-mount hook. This bootstrap uses `window.location.origin` because it runs only in the browser.

### `src/main.ts`

<!-- guide-file: src/main.ts -->
```ts
import { createApp } from 'vue';
import { createGhostlink } from '@ghostdagger/ghostlink-core';
import { GhostlinkPlugin } from '@ghostdagger/ghostlink-vue';
import '@ghostdagger/ghostlink-core/styles.css';
import '@ghostdagger/ghostlink-core/fonts.css'; // Optional bundled fonts.
import App from './App.vue';

const client = createGhostlink({
  app: { name: 'My Vue app', url: window.location.origin },
  network: 'testnet-10',
  auth: { baseUrl: '/auth/ghostlink' },
});
const app = createApp(App);
app.use(GhostlinkPlugin, client);
app.mount('#app');

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    app.unmount();
    client.destroy(); // This bootstrap instance is being permanently replaced.
  });
}
```

### 5. Render readiness, login, and logout

`useGhostlink()` returns a readonly snapshot ref. Use `.value` in script; Vue unwraps it in templates. Only interpret `session` after `initialization === 'ready'`. Keep one modal host for this client.

### `src/App.vue`

<!-- guide-file: src/App.vue -->
```vue
<script setup lang="ts">
import { ref } from 'vue';
import { GhostlinkConnectButton, GhostlinkModal, useGhostlink } from '@ghostdagger/ghostlink-vue';
import ProtectedProfile from './ProtectedProfile.vue';

const { client, snapshot } = useGhostlink();
const logoutError = ref('');
async function retry() {
  try { await client.restoreSession(); }
  catch { /* The initializationError below provides feedback. */ }
}
async function logout() {
  logoutError.value = '';
  try { await client.disconnect(); }
  catch (error) { logoutError.value = error instanceof Error ? error.message : 'Sign out failed.'; }
}
</script>

<template>
  <main>
    <h1>My Vue app</h1>
    <p v-if="snapshot.initialization === 'idle' || snapshot.initialization === 'restoring'" role="status">
      Checking your session…
    </p>
    <section v-else-if="snapshot.initialization === 'error'">
      <p role="alert">{{ snapshot.initializationError?.message }}</p>
      <button type="button" @click="retry">Retry session check</button>
    </section>
    <section v-else>
      <GhostlinkConnectButton />
      <template v-if="snapshot.session">
        <h2>Signed in</h2>
        <p>{{ snapshot.session.address }}</p>
        <ProtectedProfile :key="snapshot.session.accountId + snapshot.session.issuedAt" />
        <button type="button" :disabled="snapshot.busy" @click="logout">Sign out</button>
      </template>
      <p v-else>Signed out. Connect a wallet and sign the login message.</p>
    </section>
    <p v-if="logoutError" role="alert">{{ logoutError }}</p>
    <p v-if="snapshot.revocationPending" role="status">
      Signed out locally. Server revocation is pending; keep this app open while it retries.
    </p>
    <GhostlinkModal />
  </main>
</template>
```

### 6. Make a protected request

The profile component mounts only for a ready, authenticated session. It fetches automatically, sends the same-origin cookie, and cancels the request when it unmounts. Keying it by session identity removes old protected data when the account or session changes. A server `401` triggers revalidation; network and other HTTP failures show an error.

A protected HTTP request requires a verified session, not an active wallet connection. Wallet signing or transfers have separate connection and capability requirements.

### `src/private-api.ts`

<!-- guide-file: src/private-api.ts -->
```ts
export interface PrivateProfile {
  message: string;
  accountId: string;
}

export async function loadPrivateProfile(signal: AbortSignal): Promise<PrivateProfile | null> {
  const response = await fetch('/api/private', { credentials: 'same-origin', signal });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error(`Protected request failed (${response.status}).`);
  return response.json() as Promise<PrivateProfile>;
}
```

### `src/ProtectedProfile.vue`

<!-- guide-file: src/ProtectedProfile.vue -->
```vue
<script setup lang="ts">
import { onMounted, onScopeDispose, ref } from 'vue';
import { useGhostlink } from '@ghostdagger/ghostlink-vue';
import { loadPrivateProfile } from './private-api';
import type { PrivateProfile } from './private-api';

const { client } = useGhostlink();
const profile = ref<PrivateProfile | null>(null);
const error = ref('');
const controller = new AbortController();
onScopeDispose(() => controller.abort());
onMounted(async () => {
  try {
    const result = await loadPrivateProfile(controller.signal);
    if (controller.signal.aborted) return;
    if (!result) {
      error.value = 'The server no longer accepts this session.';
      await client.restoreSession();
      return;
    }
    profile.value = result;
  } catch (cause) {
    if (!controller.signal.aborted) {
      error.value = cause instanceof Error ? cause.message : 'Protected request failed.';
    }
  }
});
</script>

<template>
  <section aria-label="Protected response">
    <p v-if="error" role="alert">{{ error }}</p>
    <template v-else-if="profile">
      <p>{{ profile.message }}</p>
      <p>Verified account: {{ profile.accountId }}</p>
    </template>
    <p v-else role="status">Loading protected data…</p>
  </section>
</template>
```

## 7. Run and verify the flow

Install after saving the files:

```sh
pnpm install
pnpm typecheck
```

Start the backend in one terminal, from `my-ghostlink-vue`:

```sh
pnpm dev:server
```

Start the frontend in a second terminal, from the same directory:

```sh
pnpm dev
```

Open **http://127.0.0.1:5173**. Use exactly this host; `localhost` is a different cookie/origin configuration. The backend port 5174 is internal to the development proxy. Keep the backend running for the entire flow.

1. Start with a fresh browser session. You should briefly see **Checking your session…**, then **Signed out**. Visiting `/api/private` returns HTTP 401.
2. Set your KasWare or Kastle extension to **Testnet 10**. Select **Connect wallet**, select the installed wallet, approve connection, choose **Continue to sign in**, then **Sign message** and approve in the wallet. Login requires no funds or transfer.
3. After backend verification, the modal closes and **Signed in** appears. The protected response displays the verified account ID. Connection approval alone does not authenticate.
4. Reload the page. The provider checks the cookie session automatically, shows the same identity, and reloads protected data without requesting another signature. An unavailable wallet does not by itself invalidate a server session.
5. Choose **Sign out**. The UI clears protected data, and the backend revokes the session. `/api/private` returns 401 again; reloading remains signed out.
6. Stop the backend and reload to see the initialization error. Restart it and choose **Retry session check**. An unavailable backend is an unresolved identity, not proof of logout.

`disconnect()` is the explicit logout operation. If revocation cannot reach the server, `revocationPending` remains visible and the attached client retries. Local logout alone does not prove that the server cookie has been revoked. Ordinary component unmounting never signs out an established session.

## 8. Run the production build locally

Stop both development processes, then run:

```sh
pnpm build
GHOSTLINK_ORIGIN=http://127.0.0.1:5174 pnpm start
```

Open **http://127.0.0.1:5174**. Node now serves both `dist/` and the API; the Vite proxy is no longer involved. The trusted origin must change with the public port. The browser derives its app URL from that same origin.

For deployment, run this Node 24 server behind HTTPS with `GHOSTLINK_ORIGIN` set to the exact public origin (no path or trailing slash), preserve that Host through the reverse proxy, and persist `GHOSTLINK_DATABASE` outside ephemeral build directories. `PORT` selects the internal listener, which binds to loopback. `allowInsecureLocalhost` permits HTTP only for local loopback development; public sessions require HTTPS. Deploy `server/`, `dist/`, and the installed runtime dependencies together. Serving `dist/` alone does not provide authentication.

Commit the generated `pnpm-lock.yaml` in your app. When changing network, update both the client `network` and the server `networks` allowlist. `GHOSTLINK_API_ORIGIN` overrides the Vite proxy target if your development backend uses a different port; `GHOSTLINK_ORIGIN` always describes the URL the browser actually visits.

## Lifecycle and SSR

`GhostlinkPlugin` borrows the client you pass in. It attaches on root mount and releases on app/root unmount. For a component-scoped integration, use `<GhostlinkProvider :client="client">` instead of the plugin, with the same stable client for that provider's lifetime. Descendants use the same `useGhostlink()` API.

The final release stops browser listeners, timers, and pending session reads. It preserves an established backend session and allows the same client to mount again and revalidate. Only its creator calls `destroy()` when permanently retiring it. Clean up any additional application subscriptions using their returned unsubscribe functions.

These files are a browser SPA, not an SSR entry point. In an SSR app, create a client per request with a configured public URL instead of reading `window` or sharing a server module singleton. Imports, construction, and provider rendering are passive on the server. Render the initial idle/loading state on both server and browser; initialization starts after hydration. Authorize server routes with `auth.getSession(request)` and that request's cookies. Do not manually serialize a controller or inject a session into its snapshot. See the [full lifecycle and SSR contract](lifecycle.md).

For a fresh-login-only continuation, such as navigation after login, subscribe to `client.onAuthenticated(listener)` and dispose the returned unsubscribe with your component/application scope. It fires after verification, not on session restoration. Use the reactive snapshot for ordinary authenticated rendering, as this guide does.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Package install tries to fetch an unpublished Ghostlink version | Confirm the selected matching version is published to npm; before publication use the repository guide checker with local archives. |
| Session checks fail or return HTML | Start the backend; keep both proxy routes and the `/auth/ghostlink` base URL; do not use a static-only preview as an auth server. |
| Origin/Host or CSRF rejection | Match scheme, host, and port exactly; keep `changeOrigin: false`; open `127.0.0.1`, not `localhost`. |
| Wallet reports network mismatch | Set Testnet 10 in both the wallet and client; keep it in the backend allowlist. |
| Login returns after a refresh but no login callback runs | Restoration is snapshot state; `onAuthenticated` only reports fresh verification. |
| Signing is unavailable after successful restoration | Server authentication and wallet connectivity are separate. Protected HTTP requests still work; wallet operations require a live compatible provider. |

The repository's `pnpm check:guides` extracts these exact file blocks, installs the packed packages in standalone apps, builds them, and exercises login, protected requests, restoration, failure retry, and logout in Chromium. Wallet approvals in those tests use deterministic fixtures; [real-wallet acceptance](../testing/live-wallets.md) is tracked separately.
