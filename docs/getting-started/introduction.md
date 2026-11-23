---
description: "Kaspa wallet login, native components, and verified application sessions. Start here to understand how the pieces fit together."
updated: '2026-11-23'
---
# Introduction

## Why this exists

Every wallet login needs more than a connect button: account and network checks, a message to review, signature verification, session restoration, and useful recovery when something fails. **Ghostlink brings those pieces together for Kaspa applications.**

The browser asks a wallet for approval. Your Node backend verifies the signature and issues a revocable application session. Vue and React components share the same TypeScript controller and styling.

## What you get

- A framework-neutral controller for connecting wallets and managing authentication.
- Native Vue and React providers, a connect button, and a modal with review and error states.
- Same-origin, HttpOnly cookie sessions with server-side verification, expiry, and revocation.
- SQLite for persistent Node deployments, or Postgres and Neon for shared storage.
- Capability-checked message signatures, transaction signing, and transfers with wallet approval.

## How the pieces fit

| Package | Runs in | Responsibility |
| --- | --- | --- |
| `@ghostdagger/ghostlink-core` | Browser; passive construction during SSR | Controller, adapters, protocol types, shared styles |
| `@ghostdagger/ghostlink-vue` | Vue 3.5+ | Plugin/provider, reactive hook, native components |
| `@ghostdagger/ghostlink-react` | React 18.3 or 19 | Provider, external-store hook, native components |
| `@ghostdagger/ghostlink-server` | Node 24 | Signature verification, Web/Node handlers, durable sessions |

## What it does not do

Ghostlink does not hold funds, collect private keys, build transaction payloads, or assign application roles. Connecting a wallet is not authentication. Your server remains responsible for authorization and for protecting your own mutations.

The default chooser contains KasWare and Kastle browser extensions. It does not provide a WalletConnect relay, automatic mobile pairing, or a standalone Nuxt module. See [networks and capabilities](../concepts/networks.md) for the evidence and limits of each integration.

> [!NOTE]
> These docs cover the public `0.1.0-beta.2` release. Ghostlink's original code is MIT licensed; bundled third-party assets retain their own terms. No independent security audit is claimed.

## Next

[Install the packages](installation.md), then choose a complete integration in the [Quickstart](quickstart.md). Wallet authors can begin with the [adapter contract](../integration/wallet-adapters.md).
