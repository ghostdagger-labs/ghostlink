---
description: "Use the Vue binding in Nuxt with a client per SSR request, passive server rendering, and same-origin Node authentication."
updated: '2026-11-23'
---
# Nuxt / SSR

## Use the Vue binding

Install the core, Vue, and server packages from [Installation](../getting-started/installation.md). Ghostlink does not ship a Nuxt module. Use its exported Vue components and mount a provider inside your app.

Configure your public application origin in Nuxt runtime configuration; supply it from trusted deployment configuration rather than deriving it from incoming headers.

<!-- docs-check: nuxt-config.ts -->
```ts
import { defineNuxtConfig } from 'nuxt/config';

export default defineNuxtConfig({
  css: ['@ghostdagger/ghostlink-core/styles.css', '@ghostdagger/ghostlink-core/fonts.css'],
  runtimeConfig: {
    public: { appOrigin: 'http://127.0.0.1:3000' },
  },
});
```

Set `NUXT_PUBLIC_APP_ORIGIN` to the exact HTTPS origin in production. Configure the server with that same trusted origin and a compatible network.

## Create the provider in setup

Use this in `app.vue`, or in a layout that owns the login experience. Vue setup runs separately per SSR request, so the client is never shared between users.

<!-- docs-check: NuxtApp.vue -->
```vue
<script setup lang="ts">
import { useRuntimeConfig } from 'nuxt/app';
import { createGhostlink } from '@ghostdagger/ghostlink-core';
import { GhostlinkProvider, GhostlinkConnectButton, GhostlinkModal } from '@ghostdagger/ghostlink-vue';

const config = useRuntimeConfig();
const client = createGhostlink({
  app: { name: 'My Kaspa app', url: String(config.public.appOrigin) },
  network: 'testnet-11',
});
</script>

<template>
  <GhostlinkProvider :client="client">
    <GhostlinkConnectButton />
    <GhostlinkModal />
    <slot />
  </GhostlinkProvider>
</template>
```

Replace the slot with your application's `NuxtPage` or existing layout content when using this as the app root. Keep the client stable and one modal per client. A descendant uses `useGhostlink()`; in script, read `snapshot.value.initialization` and `snapshot.value.session`.

## Mount a Node backend

Ghostlink's server accepts standard Web Requests. Follow [Node setup](../backend/node.md) to configure `createGhostlinkServer`, then forward the Nuxt catch-all route `server/routes/auth/ghostlink/[...path].ts` to `auth.handle(request)`. Preserve all Set-Cookie headers and the trusted host. The repository's [Nuxt auth handler](../../website/server/routes/auth/ghostlink/%5B...path%5D.ts) is a working implementation.

Keep the server/storage instance in server-only code; a bounded shared database pool is appropriate there. This is different from sharing a browser client. Use `getSession(request)` in protected handlers and implement application permissions and mutation CSRF checks yourself.

For Nitro builds, retain the server package's relative Kaspa loader and WASM assets. The [website configuration](../../website/nuxt.config.ts) contains its explicit packaging hook. Verify the built server, not only the dev server. Use Node 24, not an edge preset.

## Hydration and route guards

Constructing a client and rendering a provider are passive on the server. Browser activity begins on mount. Server and first browser render start with the same idle snapshot, so a loading state can hydrate consistently.

Client route guards must wait for readiness. A failed restoration is an error to retry, not proof of sign-out. Server authorization always uses the current request's cookies.

## Finish and verify

Use the [Vue guide's protected request](vue.md#6-make-a-protected-request) in your application. Confirm fresh login, reload restoration, protected requests, and logout against the exact public origin. A successful logout must invalidate copied cookies at the backend. Review [Provider lifecycle](lifecycle.md) before introducing nested providers or custom cleanup.
