# Ghostlink website

Nuxt 4 / Vue / TypeScript landing page, package and integration guide hub, and the existing Vue example at `/demo`. The default experience presents KasWare and Kastle browser wallets only; mobile/hardware options and prospective wallet cards are hidden. The [deferred integration findings](../docs/roadmap/wallet-integrations.md) record the UX policy and future candidates. The Node server uses the unchanged `@ghostdagger/ghostlink-server` API and SQLite. The original design files are preserved; the [claim audit and roadmap](../docs/roadmap/landing-page-reconciliation.md) explain copy corrections.

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

The displayed snippets are read from source and independently typechecked. A Vite plugin (`tools/highlight-examples.ts`) uses Shiki at build time to generate syntax tokens for TypeScript, Vue, TSX, and the npm commands. Vue renders the tokens as escaped text; no highlighting engine or grammars are shipped to browsers. The palette uses the site's theme variables. Vue/React snippets assume a configured provider and verification backend. Landing-page visits do not create wallet controllers or discover wallets. Controllers belong to `/demo` and are destroyed when the component unmounts.

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

**Authentication requires separate storage work before it can run on Vercel Functions.** The current `/auth/ghostlink/*`, `/api/private`, and `/api/health` handlers use a local SQLite file. [Vercel Functions have a read-only filesystem and instance-local temporary storage](https://vercel.com/docs/functions/runtimes#file-system-support), so moving that file to `/tmp` does not provide shared, durable sessions or challenges. Use a shared storage adapter or host the authentication backend on the persistent Node/Docker deployment below. Set `GHOSTLINK_ORIGIN` to the exact public origin when configuring that backend. A successful website build does not make the existing SQLite authentication backend compatible with Vercel.

## Production / Docker

```sh
docker compose up --build -d
```

Open **http://127.0.0.1:3000**. One service serves `/`, `/docs`, `/demo`, `/auth/ghostlink/*`, `/api/private`, and `/api/health`. A named `ghostlink-data` volume persists SQLite across container replacements. Do not remove this volume when upgrading. The image runs as the non-root Node user and closes storage on graceful shutdown.

For a public deployment, set `GHOSTLINK_ORIGIN=https://your-exact-domain.example` in the root Compose `.env` or invoking environment. Terminate HTTPS at your reverse proxy and preserve the configured Host header. The app deliberately does not trust arbitrary forwarded host or peer-IP headers. HTTP authentication is allowed only for the explicitly configured loopback origin; `0.0.0.0` is a listening address, not a valid public authentication origin. The Compose port binds to loopback for use behind a local proxy. Set `GHOSTLINK_PORT` to change the host port and update `GHOSTLINK_ORIGIN` to match.

For a Node deployment without Docker, set `GHOSTLINK_ORIGIN` and `GHOSTLINK_DATABASE`, then run `node website/.output/server/index.mjs`; `HOST` and `PORT` control binding. Keep the entire `.output` directory together. Nuxt's compile hook emits a separate verification package with its vendor WASM so the relative loader remains intact; no verifier is served under public assets.

The site links all four public npm packages and pins install commands to `0.1.0-beta.2`, verified against the registry and published archives on 2026-11-23. `app/data/release.ts` owns release metadata, package links, and install commands; update it only after checking the published release. `/docs` links the complete integration guides and documents the main client/server methods. The TypeScript, Vue, React, and Node snippets use published APIs. No deployment is performed by the build.

## Visual and container verification

The four reviewed screenshot baselines cover dark/light desktop (1280px) and mobile (390px). Additional accessibility/overflow checks run at 360px and 768px. `artifacts/website/` contains full-page screenshots from the most recent run. Intentional content and contrast differences from the prototype are recorded in the reconciliation document. Fonts are self-hosted; their upstream OFL notices are retained in `public/licenses/`.

To check an already-running container, set `WEBSITE_TEST_ORIGIN` before running `pnpm test:website`. The opt-in restart test additionally requires `GHOSTLINK_TEST_CONTAINER` naming the **dedicated test container**, which it will restart. It signs in using a public fixture key and verifies the same authenticated session afterward. Never point this check at a shared or production container.
