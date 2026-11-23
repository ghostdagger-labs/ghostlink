---
description: "Choose a complete integration and verify the entire login, restoration, protected-request, and logout flow."
updated: '2026-11-23'
---
# Quickstart

## Pick a path

| Your app | Start here | What you will build |
| --- | --- | --- |
| Vue SPA | [Vue walkthrough](../integration/vue.md) | Vite frontend, plugin, button/modal, Node backend, protected profile |
| React SPA | [React walkthrough](../integration/react.md) | Stable provider client, Strict Mode-safe lifecycle, protected profile |
| Custom UI | [Headless TypeScript](../integration/typescript.md) | Explicit wallet actions and session rendering |
| Nuxt | [Nuxt / SSR](../integration/nuxt.md) | Request-scoped Vue integration and same-origin server handlers |
| Next.js on Vercel | [Vercel deployment](../../examples/vercel-neon/README.md) | App Router example with shared Neon sessions |

The Vue and React walkthroughs are complete copyable applications. Their marked files are extracted, compiled, and exercised by the repository's integration-guide tests.

## Configure both sides

1. Install matching `0.1.0-beta.2` packages and import the core stylesheet.
2. Choose the public origin, including scheme and port. Use the same origin in the browser and server.
3. Mount the server's authentication endpoints at `/auth/ghostlink`.
4. Select an allowed network on both client and server. KasWare supports Testnet 11; Kastle is guarded to mainnet and Testnet 10.
5. Create one stable client per provider lifetime. During SSR, create one per request.
6. Mount one modal for that client, or implement an explicit headless flow.

For a Vite development app, the walkthroughs proxy the authentication and protected API routes to Node. Browser requests still use the frontend's origin.

## Verify a login

Connect a supported wallet and approve the login message. Login requires no funds. A completed signature alone is not success: wait for backend verification and a ready snapshot with a session.

Check all of these behaviors before shipping:

- A fresh login reaches your application's success state.
- A protected server endpoint returns the verified identity.
- Reload restores a valid session without a new signature prompt.
- Sign-out clears the UI and causes subsequent protected requests to return 401.
- Rejection, a network mismatch, and a failed session check offer understandable recovery.

## Decide when identity is ready

Wait for `snapshot.initialization === 'ready'` before treating `snapshot.session` as current. A null session while restoring is unresolved; a retained session after a failed check is last-known information.

Use `onAuthenticated()` for a fresh-login continuation. It does not fire during restoration. Server-side protected routes must independently call `auth.getSession(request)`.

## Where to go next

Read [Authentication and sessions](../concepts/sessions.md) for the trust boundary, [Provider lifecycle](../integration/lifecycle.md) for ownership and SSR, and [Errors](../reference/errors.md) for recovery.
