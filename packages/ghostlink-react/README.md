# ghostlink-react

Native React 18.3/19 components for Ghostlink. Requires `ghostlink-core` and a configured authentication backend.

Start with the [complete React integration guide](../../docs/integration/react.md) for copyable app and backend files, login, protected requests, session restoration, and logout.

```tsx
import { createGhostlink } from 'ghostlink-core';
import { GhostlinkProvider, GhostlinkConnectButton, GhostlinkModal } from 'ghostlink-react';
import 'ghostlink-core/styles.css';
import 'ghostlink-core/fonts.css';
import { useState } from 'react';
export function Login() {
  const [client] = useState(() => createGhostlink({ app: { name: 'Your dApp', url: 'https://app.example' } }));
  return <GhostlinkProvider client={client}>
    <GhostlinkConnectButton />
    <GhostlinkModal />
  </GhostlinkProvider>;
}
```

`useGhostlink()` returns `{ client, snapshot }`. The button and modal accept `theme` and a `variables` map for scoped `--ghostlink-*` overrides. Render-function children receive `snapshot` plus `open` for the button or `client` for the modal. Keep one modal per controller.

The provider initializes the client after mounting, even when you use only `useGhostlink()` and custom UI. It releases its attachment on cleanup and supports React Strict Mode's setup/cleanup replay. It never destroys an externally supplied client or signs out an established session. Keep the provider near the app root and use a stable client for its lifetime; use a new provider `key` to replace it deliberately. Ordinary rerenders must not create new clients.

Gate identity-dependent UI on `snapshot.initialization === 'ready'`. `idle` and `restoring` are unresolved; `error` exposes `snapshot.initializationError`, with retry through `client.restoreSession()`. A retained `snapshot.session` alone does not establish readiness. Button mounting has no initialization side effect; the standard button is disabled while the initial check is pending.

The creator owns final destruction. Normal provider cleanup releases active resources without needing `destroy()`; call it only when permanently retiring the instance, never from a reusable React effect cleanup. Imports, construction and server rendering are passive and safe without `window`/`document`. Create a separate client per SSR request; browser initialization runs after hydration.

Pre-release. The repository documents security, the proposed Kaspa authentication profile, theming and outstanding real-wallet acceptance. Generic compatibility signing does not claim wallet-side phishing resistance.
