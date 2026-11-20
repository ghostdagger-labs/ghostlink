# ghostlink-vue

Native Vue 3.5+ components for Ghostlink. Requires `ghostlink-core` and a configured `ghostlink-server` backend.

Start with the [complete Vue integration guide](../../docs/integration/vue.md) for copyable app and backend files, login, protected requests, session restoration, and logout.

```ts
import { createGhostlink } from 'ghostlink-core';
import { GhostlinkPlugin } from 'ghostlink-vue';
import 'ghostlink-core/styles.css';
import 'ghostlink-core/fonts.css';
const client = createGhostlink({ app: { name: 'Your dApp', url: 'https://app.example' } });
app.use(GhostlinkPlugin, client);
```

Render one `<GhostlinkModal />` and a `<GhostlinkConnectButton />`. Both accept `theme="dark" | "light"` and a `variables` map of `--ghostlink-*` branding overrides. `useGhostlink()` returns `{ client, snapshot }`, where snapshot is a shallow readonly ref. `GhostlinkProvider` offers component-local injection as an alternative to the app plugin.

The connect button's default slot receives `snapshot` and `open`. The modal's `content` slot receives `snapshot` and `client`; custom content assumes accessibility/review responsibilities. Subscriptions clean up with component scopes.

The plugin activates the client when the app root mounts and releases it when the app unmounts. `GhostlinkProvider` does the same for its component lifetime. Both initialize without a connect button. They borrow supplied clients: cleanup stops the final attachment's browser activity without destroying the client or signing out an established session. Keep a stable client per provider lifetime; use a new provider `key` to replace it deliberately.

Gate identity-dependent UI on `snapshot.value.initialization === 'ready'` (or `snapshot.initialization` in templates). `idle` and `restoring` are unresolved; `error` exposes `initializationError`. Retry with `client.restoreSession()`. A retained session is only the last known session until readiness is restored. The standard connect button is disabled while the check is pending.

Imports, construction, provider rendering and plugin installation are passive during SSR. Create a separate client per request; discovery and restoration begin after browser mounting. Normal provider/plugin cleanup releases active resources. The creator calls `client.destroy()` only when permanently retiring an instance.

Pre-release. Generic compatibility signing is verified by the backend but does not provide wallet-side domain enforcement. Real-wallet acceptance is recorded separately from automated provider fixtures in the repository documentation.
