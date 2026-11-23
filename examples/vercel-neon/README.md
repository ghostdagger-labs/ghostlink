---
description: "Deploy the complete Next.js example with shared Neon sessions, trusted origins, and production WASM packaging."
updated: '2026-11-23'
---
# Vercel + Neon example

A complete Next.js App Router frontend and same-origin Node authentication backend using managed Neon Postgres. Includes KasWare/Testnet 11 and Kastle/Testnet 10 login, automatic session restoration, explicit sign-out, a protected read-only API, and production WASM packaging checks. Login requires no funds; this example does not submit transactions.

No database server needs to be operated by the developer. Provision a Neon resource, keep its credentials server-only, and deploy the frontend and functions together. This repository example uses workspace packages; standalone applications can use matching Ghostlink `0.1.0-beta.2` packages, which include the Postgres adapter.

## Run locally with Neon

Use Node 24 and pnpm 11.7.0. From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm build:vercel
cp examples/vercel-neon/.env.example examples/vercel-neon/.env.local
```

Edit `.env.local`: set `DATABASE_URL` to the primary Neon connection string (the pooled endpoint is supported), keep `GHOSTLINK_ORIGIN=http://localhost:3200`, and use a development database/branch. Never add `NEXT_PUBLIC_` to database variables. The explicit insecure-loopback flag is for local development and is ignored on Vercel. Use `localhost` in the browser too: Next.js normalizes loopback request URLs to that hostname, and Ghostlink checks exact origins.

```sh
pnpm --filter ghostlink-example-vercel-neon db:migrate
pnpm dev:vercel
```

Open `http://localhost:3200` in the wallet browser. Select the matching network in both the page and wallet. The selected network is remembered in the page URL so reload uses the same authentication policy; it is not a session credential. Sign in, test the protected request, reload, and sign out. To run the production build locally, use `pnpm --filter ghostlink-example-vercel-neon start` instead of `pnpm dev:vercel`.

The migration command loads `.env.local`; it prefers `MIGRATION_DATABASE_URL` if provided. Use an owner role for migration and a restricted runtime role for `DATABASE_URL` if your setup separates credentials. See [Postgres permissions and guarantees](../../docs/integration/postgres.md).

## Deploy this repository on Vercel

1. Import the repository and set **Root Directory** to `examples/vercel-neon`, framework **Next.js**, and Node **24.x**. Enable **Include source files outside of the Root Directory in the Build Step** so workspace packages can be built. The supplied `vercel.json` installs at the workspace root and runs `pnpm build:vercel`.
2. Add Neon through the Vercel Marketplace or connect an existing Neon project. Use its writable primary endpoint. Set the function region close to the database; the example defaults to `iad1` (US East).
3. Configure `DATABASE_URL`, `GHOSTLINK_DATABASE_SCHEMA=ghostlink`, and `GHOSTLINK_ORIGIN=https://your-exact-domain.example` in the appropriate Vercel environment. Do not include a trailing slash in the origin. Production always requires HTTPS. Do not derive this trust policy from request headers.
4. Run `db:migrate` once against the target database with the intended schema before serving traffic. This is an explicit deployment step, not a build hook or request-time migration. Do not give ordinary preview builds production migration credentials.
5. Deploy. The build verifies both authentication functions include the unmodified Kaspa JS loader and WASM and that server code did not leak into browser bundles. No SQLite file or filesystem volume is used.
6. On the deployed domain, sign in, reload, call the protected API, and sign out. Confirm `/api/private` returns 401 after sign-out and auth responses use `Cache-Control: no-store`. Repeat after a redeploy to exercise new function instances against the shared store.

Use a separate Neon database/branch or schema and credentials for previews. Configure the exact preview origin independently (a stable preview domain simplifies this); an origin configured for production intentionally rejects requests from another domain. Do not share production auth state with untrusted preview code. Set a canonical domain and redirect aliases to it before login.

If copying this example outside the monorepo, replace `workspace:*` with `0.1.0-beta.2` for each Ghostlink dependency, install dependencies, change the Vercel install/build commands to `pnpm install --frozen-lockfile` / `pnpm build`, and set `outputFileTracingRoot` to the new project root in `next.config.mjs`. Keep the external server package and vendor tracing configuration. The older `0.1.0-beta.1` package does not support these subpath imports.

## Files and ownership

- `app/wallet-app.tsx`: client construction, provider lifecycle, network selection, restoration/error state, sign-out, and protected request UI. No session secrets are stored in browser databases.
- `app/auth/ghostlink/[...path]/route.ts`: GET/POST auth handlers, Node runtime, no caching, trusted Vercel peer metadata only when running on Vercel.
- `app/api/private/route.ts`: session-authenticated GET with origin checks and no-store responses. Application permissions and mutation CSRF checks remain the host's responsibility.
- `server/auth.ts`: lazy, bounded Neon pool and Ghostlink server. `attachDatabasePool()` releases idle connections before Vercel suspends functions; it does not close a pool used by active requests.
- `scripts/migrate.ts`: explicit versioned migration and asynchronous pool shutdown.
- `next.config.mjs` / `scripts/check-build.mjs`: preserve and check the official Node WASM loader and assets in both function traces.

The backend uses the current five-minute single-use challenges, 24-hour absolute/30-minute idle sessions, browser binding, hashed cookie tokens, CSRF, origin checks, and shared rate limits. Database failures do not fall back to in-memory or browser authentication. Neon support uses its `Pool` WebSocket driver for interactive transactions, not the HTTP `neon()` query function. Keep the database URL's TLS settings and the driver's defaults; the local test proxy is never part of the deployed example.

## Automated and live checks

From the repository root, follow the [isolated Postgres test setup](../../docs/integration/postgres.md#verification), then run `pnpm test:postgres`, `pnpm build:vercel`, and `pnpm test:vercel`. Browser tests use fixture wallets that make real signatures against the built Next.js server and real Postgres through the Neon driver. They verify both wallet paths, restoration, protected access, copied-cookie revocation, and origin/CSRF rejection. They do not connect to a live Neon project or deploy to Vercel; complete the deployed-domain checks above with your own resource.

Upstream references: [Vercel storage](https://vercel.com/docs/storage), [Neon driver](https://neon.com/docs/serverless/serverless-driver), [Vercel pool management](https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package#attachdatabasepool), [Next.js external packages](https://nextjs.org/docs/app/api-reference/config/next-config-js/serverExternalPackages), [Next.js output tracing](https://nextjs.org/docs/app/api-reference/config/next-config-js/output).
