# Ghostlink website

Nuxt 4 / Vue / TypeScript landing page, docs placeholder, and the existing Vue example at `/demo`. The Node server uses the unchanged `ghostlink-server` API and SQLite. The original design files are preserved; the [claim audit and roadmap](../docs/roadmap/landing-page-reconciliation.md) explain copy corrections.

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

## Production / Docker

```sh
docker compose up --build -d
```

Open **http://127.0.0.1:3000**. One service serves `/`, `/docs`, `/demo`, `/auth/ghostlink/*`, `/api/private`, and `/api/health`. A named `ghostlink-data` volume persists SQLite across container replacements. Do not remove this volume when upgrading. The image runs as the non-root Node user and closes storage on graceful shutdown.

For a public deployment, set `GHOSTLINK_ORIGIN=https://your-exact-domain.example` in the root Compose `.env` or invoking environment. Terminate HTTPS at your reverse proxy and preserve the configured Host header. The app deliberately does not trust arbitrary forwarded host or peer-IP headers. HTTP authentication is allowed only for the explicitly configured loopback origin; `0.0.0.0` is a listening address, not a valid public authentication origin. The Compose port binds to loopback for use behind a local proxy. Set `GHOSTLINK_PORT` to change the host port and update `GHOSTLINK_ORIGIN` to match.

For a Node deployment without Docker, set `GHOSTLINK_ORIGIN` and `GHOSTLINK_DATABASE`, then run `node website/.output/server/index.mjs`; `HOST` and `PORT` control binding. Keep the entire `.output` directory together. Nuxt's compile hook emits a separate verification package with its vendor WASM so the relative loader remains intact; no verifier is served under public assets.

The site has no analytics, publication integration, or mail subscription. Package installation remains unavailable pending registry publication. No deployment is performed by the build.

## Visual and container verification

The four reviewed screenshot baselines cover dark/light desktop (1280px) and mobile (390px). Additional accessibility/overflow checks run at 360px and 768px. `artifacts/website/` contains full-page screenshots from the most recent run. Intentional content and contrast differences from the prototype are recorded in the reconciliation document. Fonts are self-hosted; their upstream OFL notices are retained in `public/licenses/`.

To check an already-running container, set `WEBSITE_TEST_ORIGIN` before running `pnpm test:website`. The opt-in restart test additionally requires `GHOSTLINK_TEST_CONTAINER` naming the **dedicated test container**, which it will restart. It signs in using a public fixture key and verifies the same authenticated session afterward. Never point this check at a shared or production container.
