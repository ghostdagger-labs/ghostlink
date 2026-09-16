# ghostlink-react

Native React 18.3/19 components for Ghostlink. Requires `ghostlink-core` and a configured authentication backend.

```tsx
import { createGhostlink } from 'ghostlink-core';
import { GhostlinkProvider, GhostlinkConnectButton, GhostlinkModal } from 'ghostlink-react';
import 'ghostlink-core/styles.css';
import 'ghostlink-core/fonts.css';
const client = createGhostlink({ app: { name: 'Your dApp', url: 'https://app.example' } });
export const Login = () => <GhostlinkProvider client={client}>
  <GhostlinkConnectButton />
  <GhostlinkModal />
</GhostlinkProvider>;
```

`useGhostlink()` returns `{ client, snapshot }`. The button and modal accept `theme` and a `variables` map for scoped `--ghostlink-*` overrides. Render-function children receive `snapshot` plus `open` for the button or `client` for the modal. Keep one modal per controller.

Use a stable controller per app instance and dispose it with `destroy()` when its owner unmounts. Imports and server rendering are safe without `window`/`document`. Do not share authenticated controller state across SSR requests.

Pre-release. The repository documents security, the proposed Kaspa authentication profile, theming and outstanding real-wallet acceptance. Generic compatibility signing does not claim wallet-side phishing resistance.
