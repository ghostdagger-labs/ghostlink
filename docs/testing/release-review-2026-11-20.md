# Beta release review — 2026-11-20

Target: all four public `@ghostdagger/ghostlink-*` packages at `0.1.0-beta.1`.

## Dependencies

The initial registry audit reported 77 production advisories and 82 across the full workspace. After dependency updates, both `pnpm audit --prod` and `pnpm audit` reported zero advisories. This is a point-in-time advisory check, not a security certification.

Updates include Nuxt 4.6.4, tsup 9, Vitest 4.1.12, patched Vite releases, esbuild and compatible package dependencies. Node remains pinned to 24.16.0. The narrow `archiver@8>readdir-glob` override selects 4.0.0 to remove vulnerable minimatch 10; upstream's version diff changes the dependency and Node minimum without changing its implementation. Remove the override when Archiver adopts that version. Peer dependency checks passed.

CI now audits the full workspace. Installed-package checks also audit the anonymous consumer's production dependencies with npm and pnpm, so the shipped dependency graph is checked separately from the workspace lockfile.

## Wallets and assets

The maintainer confirmed permission to retain and redistribute the KasWare and Kastle logos. The permission record is in `THIRD_PARTY_NOTICES.md` and the packaged asset provenance; upstream license and trademark terms remain included. All three wallet PNGs match their recorded SHA-256 checksums. Installed-package checks now verify those checksums too. Font and WASM notices remain included.

Provider signatures were reviewed against the current KasWare and Kastle APIs. Existing wallet guards and transaction APIs remain enabled. The maintainer explicitly deferred remaining live protected-API and testnet transaction acceptance to a later pass. Existing user-reported login evidence is unchanged; automated fixtures do not establish live transaction compatibility. See [the compatibility record](compatibility-v1.json) and [open acceptance checklist](live-wallets.md).

## Validation before GitHub verification

- Production build and workspace type checks passed.
- 102 unit tests and seven release-safety tests passed.
- Clean npm and pnpm archive installations passed runtime, SSR, TypeScript, asset, SQLite, WASM and 48 hover-documentation contracts, with zero production dependency advisories.
- The full browser, website and guide suites run again in the release workflow before publication. Successful local checks alone do not mark a release as published.

## Publication verification

Commit `936d8c97c71ed23c7679d6497dca8123210b6e98`, tagged `sdk-v0.1.0-beta.1`, passed GitHub verification: 102 unit tests, seven release-safety tests, 46 SDK browser tests, 22 website tests and 24 integration-guide tests. The Docker restart test was skipped in that run. The updated accessibility checker exposed two button-label mismatches; those were fixed before the successful run.

All four public npm archives match the tested SHA-512 hashes. Anonymous npm and pnpm consumers passed with empty caches/stores, including runtime, TypeScript, asset and hover-documentation checks. Both consumer production audits reported zero advisories.

npm publication processing temporarily returned 404 responses for install metadata and tarballs. The release verifier now waits for both, verifies downloaded bytes, and uses fresh consumer caches; ten release-safety tests cover the updated tooling. npm also assigned `latest` for this initial publication and rejected its removal. This release remains a beta; use the explicit `beta` tag or `0.1.0-beta.1`.
