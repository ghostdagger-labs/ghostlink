# ghostlink-vue

Native Vue 3.5+ components for Ghostlink. Requires `ghostlink-core` and a configured `ghostlink-server` backend.

```ts
import { createGhostlink } from 'ghostlink-core';
import { GhostlinkPlugin } from 'ghostlink-vue';
import 'ghostlink-core/styles.css';
import 'ghostlink-core/fonts.css';
const client = createGhostlink({ app: { name: 'Your dApp', url: 'https://app.example' } });
app.use(GhostlinkPlugin, client);
```

Render one `<GhostlinkModal />` and a `<GhostlinkConnectButton />`. Both accept `theme="dark" | "light"` and a `variables` map of `--ghostlink-*` branding overrides. `useGhostlink()` returns `{ client, snapshot }`, where snapshot is a shallow readonly ref. `GhostlinkProvider` offers component-local injection as an alternative to the app plugin.

The connect button's default slot receives `snapshot` and `open`. The modal's `content` slot receives `snapshot` and `client`; custom content assumes accessibility/review responsibilities. Imports are SSR safe and subscriptions clean up with component scopes. Dispose the owning controller with `client.destroy()` when the application closes.

Pre-release. Generic compatibility signing is verified by the backend but does not provide wallet-side domain enforcement. Real-wallet acceptance is recorded separately from automated provider fixtures in the repository documentation.
