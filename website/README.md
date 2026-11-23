# Ghostlink website

Nuxt 4 / Vue / TypeScript landing page, docs placeholder, and the existing Vue example at `/demo`. The default experience presents KasWare and Kastle browser wallets only; mobile/hardware options and prospective wallet cards are hidden. The [deferred integration findings](../docs/roadmap/wallet-integrations.md) record the UX policy and future candidates. The Node server uses `@ghostdagger/ghostlink-server` with Neon/Postgres on Vercel and SQLite by default for local development. Both use real signature verification, server-side sessions, and the protected API. The original design files are preserved; the [claim audit and roadmap](../docs/roadmap/landing-page-reconciliation.md) explain copy corrections.

## Local development

From the repository root, use Node 24 and pnpm 11.7.0:

```sh
pnpm install --frozen-lockfile
pnpm build:website
pnpm dev:website
```

Open **http://127.0.0.1:3000**. Use that exact host for authentication. The standalone example remains available through `pnpm dev` on port 5173. Development uses `website/.data/ghostlink.sqlite`; set `GHOSTLINK_DATABASE` to change it.

```sh
pnpm typecheck
pnpm test:website
pnpm test
pnpm test:browser
pnpm check:package
```

The displayed snippets are loaded as raw source and independently typechecked. Vue/React snippets assume a configured provider and verification backend. Landing-page visits do not create wallet controllers or discover wallets. Controllers belong to `/demo` and are destroyed when the component unmounts.

## Vercel builds

Use these project settings:

- Framework Preset: **Nuxt**.
- Root Directory: **website**. Enable **Include source files outside of the Root Directory in the Build Step** so the workspace packages and build tools are available.
- Node.js Version: **24.x**. Set `ENABLE_EXPERIMENTAL_COREPACK=1` so Vercel uses pnpm **11.7.0**, as pinned in the root `package.json` ([Vercel Corepack setup](https://vercel.com/docs/builds/configure-a-build#corepack)).
- Install Command: `pnpm install --frozen-lockfile`.
- Build Command: `pnpm run build`.
- Output Directory: leave the framework default; Nitro generates `website/.vercel/output` from the repository root.

The website build first builds its workspace dependencies in dependency order. Their exports point at generated `dist/` files, which are not committed. Running `nuxt build` directly on a fresh checkout skips those builds and can fail to resolve `@ghostdagger/ghostlink-core`. Keep using the package build script rather than externalizing the client SDK. Nitro detects Vercel automatically; local and Docker builds retain the Node server output.

To check the Vercel build locally, run `NITRO_PRESET=vercel pnpm build:website` from the repository root. This generates build artifacts without deploying them.

### Neon authentication

The existing `ghostlink` Vercel project serves this website, including `/demo`, `/auth/ghostlink/*`, and `/api/private`. It does not need a separate backend service. Set these **server-only** environment variables in that project:

- `DATABASE_URL`: a Neon primary endpoint connection string. The website uses the Neon `Pool` driver with interactive transactions, not the HTTP `neon()` query helper.
- `GHOSTLINK_ORIGIN`: the exact public origin, for example `https://ghostlink-tau.vercel.app`, without a path or trailing slash. Sign in through that origin; deployment aliases with different hosts are deliberately rejected.
- `GHOSTLINK_DATABASE_SCHEMA`: `ghostlink` (the default), or another dedicated schema name.

Choose a Vercel function region near the Neon primary. Keep production and preview credentials in separate Vercel environments and separate Neon branches/databases. A preview needs its own stable origin and migrated schema; do not expose production session storage to arbitrary preview code. Missing `DATABASE_URL` on Vercel makes authentication unavailable instead of falling back to an instance-local SQLite file.

The deployed `ghostlink` project uses `https://ghostlink-tau.vercel.app` in Vercel `iad1`, with the Neon `ghostlink` project in AWS US East 1. Its `production` branch uses the `ghostlink_runtime` role. The `codex/deploy-neon-website` Vercel preview uses the separate `website-preview` database branch and `ghostlink_preview_runtime` role, which does not exist in production. These preview variables are scoped to that Git branch; other previews need their own configuration. No database credentials are stored in the repository.

Run the explicit migration once before deploying, from this checkout after `pnpm build:website`:

```sh
# Store credentials in ignored website/.env.local; never commit them.
pnpm --filter ghostlink-website db:migrate
```

The script reads `MIGRATION_DATABASE_URL` when present, otherwise `DATABASE_URL`, and uses `GHOSTLINK_DATABASE_SCHEMA`. Use an owner connection for migrations and a runtime role with schema `USAGE` plus table `SELECT`, `INSERT`, `UPDATE`, and `DELETE`. Keep migration credentials out of the runtime environment. See the [Postgres adapter guide](../docs/integration/postgres.md) for roles, transactions, and migration details. Builds and requests never run migrations.

The server reuses a bounded connection pool and attaches it to Vercel's connection lifecycle. Challenges, session hashes, browser bindings, revocation, and rate limits live in Postgres. The browser receives HttpOnly session cookies; browser storage holds wallet/network preferences only. Logout revokes the server session, including copied cookies. The SDK's authentication API is unchanged.

## Production / Docker

```sh
docker compose up --build -d
```

Open **http://127.0.0.1:3000**. One service serves `/`, `/docs`, `/demo`, `/auth/ghostlink/*`, `/api/private`, and `/api/health`. A named `ghostlink-data` volume persists SQLite across container replacements. Do not remove this volume when upgrading. The image runs as the non-root Node user and closes storage on graceful shutdown.

For a public deployment, set `GHOSTLINK_ORIGIN=https://your-exact-domain.example` in the root Compose `.env` or invoking environment. Terminate HTTPS at your reverse proxy and preserve the configured Host header. The app deliberately does not trust arbitrary forwarded host or peer-IP headers. HTTP authentication is allowed only for the explicitly configured loopback origin; `0.0.0.0` is a listening address, not a valid public authentication origin. The Compose port binds to loopback for use behind a local proxy. Set `GHOSTLINK_PORT` to change the host port and update `GHOSTLINK_ORIGIN` to match.

For a Node deployment without Docker, set `GHOSTLINK_ORIGIN` and `GHOSTLINK_DATABASE`, then run `node website/.output/server/index.mjs`; `HOST` and `PORT` control binding. Keep the entire `.output` directory together. Nuxt's compile hook emits a separate verification package with its vendor WASM so the relative loader remains intact; no verifier is served under public assets.

The site has no analytics, publication integration, or mail subscription. No deployment is performed by the build.

## Visual and container verification

The four reviewed screenshot baselines cover dark/light desktop (1280px) and mobile (390px). Additional accessibility/overflow checks run at 360px and 768px. `artifacts/website/` contains full-page screenshots from the most recent run. Intentional content and contrast differences from the prototype are recorded in the reconciliation document. Fonts are self-hosted; their upstream OFL notices are retained in `public/licenses/`.

To check an already-running container, set `WEBSITE_TEST_ORIGIN` before running `pnpm test:website`. The opt-in restart test additionally requires `GHOSTLINK_TEST_CONTAINER` naming the **dedicated test container**, which it will restart. It signs in using a public fixture key and verifies the same authenticated session afterward. Never point this check at a shared or production container.

For the Neon driver integration, build the website and run `GHOSTLINK_TEST_DATABASE_URL=postgresql://... pnpm test:website:neon` against an isolated test database. The runner creates and removes a temporary schema and bridges the driver's WebSocket transport to local Postgres. It covers real fixture-key signatures for both wallets, restoration, protected API access, cookie revocation, CSRF/origin checks, and network-change races. To smoke-test a deployed website, use `WEBSITE_TEST_ORIGIN=https://your-exact-domain.example pnpm test:website:neon`; this creates and revokes fixture-wallet sessions without touching real wallets.
