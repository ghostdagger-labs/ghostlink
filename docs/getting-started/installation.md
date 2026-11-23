---
description: "Install matching public beta packages, choose a frontend, and prepare the Node verification backend."
updated: '2026-11-23'
---
# Installation

## Choose your frontend

Install the core package and the binding for your framework. These commands pin the documented release; they do not rely on an npm dist-tag.

```sh
# Vue
npm install @ghostdagger/ghostlink-core@0.1.0-beta.2 @ghostdagger/ghostlink-vue@0.1.0-beta.2

# React
npm install @ghostdagger/ghostlink-core@0.1.0-beta.2 @ghostdagger/ghostlink-react@0.1.0-beta.2

# Headless TypeScript
npm install @ghostdagger/ghostlink-core@0.1.0-beta.2
```

Nuxt applications use the Vue binding. There is no `@ghostlink/nuxt` package or module.

## Install the backend

Run this in your server project, or in the same project when your framework has server routes:

```sh
npm install @ghostdagger/ghostlink-server@0.1.0-beta.2

# Only when using Postgres: choose one driver
npm install pg
# Or, for Neon:
npm install @neondatabase/serverless
```

SQLite uses Node's built-in `node:sqlite`. Postgres drivers are installed separately. Keep server imports and database credentials out of client code.

## Import styles

Import once in your browser entry point:

```ts
import '@ghostdagger/ghostlink-core/styles.css';
// Optional: locally bundled Figtree, Sora, and JetBrains Mono.
import '@ghostdagger/ghostlink-core/fonts.css';
```

Both the button and modal accept theme and CSS variable overrides. Read [Theming](../integration/theming.md) before replacing their default appearance.

## Requirements

| Component | Requirement |
| --- | --- |
| Verification backend | Node 24; the Kaspa verifier is not an edge-runtime implementation |
| Vue | 3.5 or newer within the declared Vue 3 peer range |
| React | React and React DOM 18.3 or 19 |
| Browser | Modern browser with Fetch, Web Crypto, and native dialog support |
| Wallet | A supported extension in the same browser; choose a supported network |
| Public hosting | HTTPS and a configured exact public origin |
| Local authentication | Explicit loopback HTTP configuration; frontend and backend share the public origin |

The repository itself uses Node 24 and pnpm 11.7.0. The [complete Vue](../integration/vue.md) and [React](../integration/react.md) guides provide compatible TypeScript and bundler configurations.

> [!WARNING]
> Installing a frontend package does not create a verification backend. A signed wallet message must be checked by your server before the application treats a user as signed in.

## Continue

Use the [Quickstart](quickstart.md) to choose a complete path. Existing servers can start with [Node setup](../backend/node.md).
