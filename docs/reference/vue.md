---
description: "Vue plugin and provider ownership, readonly reactive state, button/modal props, and customization slots."
updated: '2026-11-23'
api:
  "@ghostdagger/ghostlink-vue": ["GhostlinkPlugin","GhostlinkProvider","GhostlinkConnectButton","GhostlinkModal","useGhostlink"]
---
# Vue API

## Plugin or provider

Import from `@ghostdagger/ghostlink-vue`. Use Vue 3.5 or newer within the supported Vue 3 range.

`app.use(GhostlinkPlugin, client)` provides a stable client to the application, activates it on root mount, and releases it on unmount. Installation and SSR rendering are passive.

Alternatively, `<GhostlinkProvider :client="client">` provides a component-scoped owner. It borrows the instance; it never destroys the client or signs out an established session on ordinary teardown.

Use a keyed remount to replace a client deliberately. Passing a different instance into an existing provider throws. Change networks using `client.setNetwork()`.

## useGhostlink

`useGhostlink()` returns `{ client, snapshot }`. The snapshot is a readonly computed ref: read `snapshot.value` in script and use Vue's automatic unwrapping in templates. The hook subscribes and cleans up with the component scope; it throws outside a plugin/provider.

<!-- docs-check: VueIdentity.vue -->
```vue
<script setup lang="ts">
import { useGhostlink } from '@ghostdagger/ghostlink-vue';
const { client, snapshot } = useGhostlink();
async function retry() {
  try { await client.restoreSession(); }
  catch { /* The template renders initializationError. */ }
}
</script>

<template>
  <p v-if="snapshot.initialization === 'error'" role="status">
    {{ snapshot.initializationError?.message }}
    <button type="button" @click="retry">Retry</button>
  </p>
  <p v-else-if="snapshot.initialization !== 'ready'" role="status">Checking session…</p>
  <p v-else>{{ snapshot.session ? snapshot.session.address : 'Signed out' }}</p>
</template>
```

## GhostlinkConnectButton

| Prop | Type | Default |
| --- | --- | --- |
| `theme` | `'dark' \| 'light'` | `'dark'` |
| `variables` | `Record<string, string>` | No overrides |
| `label` | `string` | `'Connect wallet'` |

The button opens login or account details. It is disabled while initialization is idle/restoring. Its default slot receives `{ snapshot, open }` for custom content; the component still owns the outer button.

## GhostlinkModal

`theme` and `variables` have the same contract as the button. Keep one modal per controller. The modal teleports to `document.body`, presents accessible review/error states, and releases its UI and camera resources on unmount.

The `content` slot receives `{ snapshot, client }` and replaces the body. Your replacement owns review controls and equivalent accessibility. Pass theme variables to both button and modal because they do not share a DOM ancestor after teleporting.

## Next

Use the [complete Vue guide](../integration/vue.md) for setup, protected requests, and logout. See [Provider lifecycle](../integration/lifecycle.md) for nested ownership and [Theming](../integration/theming.md) for CSS tokens.
