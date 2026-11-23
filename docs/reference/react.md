---
description: "React provider lifecycle, external-store snapshots, component props, render functions, and Strict Mode behavior."
updated: '2026-11-23'
api:
  "@ghostdagger/ghostlink-react": ["GhostlinkProvider","GhostlinkConnectButton","GhostlinkModal","useGhostlink"]
---
# React API

## GhostlinkProvider

Import from `@ghostdagger/ghostlink-react`. The package supports matching React and React DOM 18.3 or 19.

`<GhostlinkProvider client={client}>` borrows a stable `Ghostlink` instance and attaches it in an effect. Cleanup releases that attachment without destroying the instance or signing out an established session. Strict Mode effect replay is supported.

Create the client with lazy state or another stable owner. During SSR, create a separate instance for each request. Use a new provider key when intentionally replacing it; changing the prop on an existing provider throws.

## useGhostlink

`useGhostlink()` returns `{ client, snapshot }` using React's external-store subscription. The snapshot is nested-readonly. The hook requires a provider and manages its own subscription cleanup.

<!-- docs-check: ReactIdentity.tsx -->
```tsx
import { useGhostlink } from '@ghostdagger/ghostlink-react';

export function Identity() {
  const { client, snapshot } = useGhostlink();
  if (snapshot.initialization === 'error') {
    return <p role="status">
      {snapshot.initializationError?.message}
      <button onClick={() => { void client.restoreSession().catch(() => {}); }}>Retry</button>
    </p>;
  }
  if (snapshot.initialization !== 'ready') return <p role="status">Checking session…</p>;
  return <p>{snapshot.session?.address ?? 'Signed out'}</p>;
}
```

Readiness, not the presence of a last-known session, determines when client identity is resolved. Protected server routes must still validate their own requests.

## GhostlinkConnectButton

| Prop | Type | Default / behavior |
| --- | --- | --- |
| `theme` | `'dark' \| 'light'` | `'dark'` |
| `variables` | `Record<string, string>` | Scoped CSS overrides |
| `label` | `string` | `'Connect wallet'` |
| `children` | Render function | Receives `{ snapshot, open }`; replaces button content |

The component opens login or account details and is disabled while initialization is idle/restoring. Avoid nesting interactive controls inside its button.

## GhostlinkModal

Use one modal per controller. It accepts `theme`, `variables`, and an optional `children({ snapshot, client })` render function that replaces the body. A custom body owns equivalent review behavior and accessible controls.

The modal renders no dialog during SSR, then portals to `document.body` on mount. Supply variables to both the button and modal. Teardown releases UI/camera resources; provider ownership controls the controller lifecycle.

## Next

Follow the [complete React guide](../integration/react.md) for stable construction, CSS imports, protected requests, and logout. Read [Provider lifecycle](../integration/lifecycle.md) before adding effect cleanup: terminal `destroy()` does not belong in an effect that React may replay.
