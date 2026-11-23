# Changelog

## 0.1.0-beta.2 — 2026-11-22

- Add transactional Postgres storage and migrations using a host-owned `pg.Pool` or Neon WebSocket `Pool`, with no required runtime database driver dependency.
- Preserve single-use challenges, session rotation/revocation, per-browser ordering, and atomic rate limits across server instances. Failed transactions roll back and authentication fails closed.
- Add `@ghostdagger/ghostlink-server/server`, `/postgres`, and `/sqlite` entry points. The server/Postgres entry points avoid importing `node:sqlite`; existing root and SQLite APIs remain compatible.
- Include a complete Next.js/Vercel + Neon example, deployment and migration guidance, WASM packaging checks, and Postgres 16/18 integration and browser tests in the release workflow.
- Advance all four SDK packages together. Use `@beta` or the exact `0.1.0-beta.2` version; `latest` remains on the initial beta until a deliberate promotion.

Automated Postgres/Neon-driver checks use real Postgres and a local WebSocket bridge. They do not certify a live Neon/Vercel account or real wallet extension. Live-wallet/protected-API and testnet transaction acceptance remains deferred; transaction APIs remain enabled.

## 0.1.0-beta.1 — 2026-11-20

- Publish the first public npm release as `@ghostdagger/ghostlink-core`, `@ghostdagger/ghostlink-server`, `@ghostdagger/ghostlink-react`, and `@ghostdagger/ghostlink-vue`.
- License Ghostlink's original code under MIT; preserve third-party licenses and provenance.
- Include framework-neutral Kaspa wallet login, Vue/React UI, and Node 24 verification with SQLite sessions.
- Add tag-selected GitHub Actions releases for `ghostdagger-labs/ghostlink`, verified archives, anonymous npm/pnpm consumer checks, and candidate-to-beta promotion.

This version is published on npm. Use the exact version or the `beta` tag; npm also retains `latest` for this initial release. The maintainer confirmed wallet-logo redistribution permission and deferred remaining live-wallet acceptance on 2026-11-20. Transaction APIs remain enabled with live protected-API and testnet transaction evidence still pending; see [the publishing guide](docs/releases/publishing.md).
