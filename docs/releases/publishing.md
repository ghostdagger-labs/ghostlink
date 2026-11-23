# Public SDK releases

Source: `ghostdagger-labs/ghostlink` on GitHub. Registry: `https://registry.npmjs.org/`. npm organization: `ghostdagger`. The first public version is **0.1.0-beta.1**, published on 2026-11-20. Its source is tagged `sdk-v0.1.0-beta.1` at commit `936d8c97c71ed23c7679d6497dca8123210b6e98`.

The current release target is **0.1.0-beta.2**, adding Postgres/Neon storage, dedicated server/storage entry points and the Vercel example. All four packages advance together. This release uses GitHub Actions trusted publishing and promotes `candidate` to `beta` after anonymous npm/pnpm consumer checks; `latest` remains `0.1.0-beta.1`.

| Package | Role |
| --- | --- |
| `@ghostdagger/ghostlink-core` | Framework-neutral client, adapters, styles and assets |
| `@ghostdagger/ghostlink-server` | Node 24 verification, handlers and SQLite sessions |
| `@ghostdagger/ghostlink-react` | React 18.3/19 UI |
| `@ghostdagger/ghostlink-vue` | Vue 3.5 UI |

All four advance together. The three dependent packages resolve the exact core release. Packages are ESM and public on npm; consumers do not need a GitHub account, token or GitHub registry configuration. The workspace root, website and example remain private package manifests and are never published.

## Release prerequisites

GitHub ownership and visibility are configured as of 2026-11-20: the existing repository was transferred to `ghostdagger-labs/ghostlink`, made public, and the local `origin` updated. Gitleaks 8.30.1 found no credentials in the 12 committed revisions checked before the visibility change. The release workflow deliberately refuses other repositories, and its publishing job requires public source for npm provenance.

1. Preserve the asset permission, license and provenance records in [third-party notices](../../THIRD_PARTY_NOTICES.md). On 2026-11-20 the maintainer confirmed permission to redistribute the KasWare/Kastle logos. Font and WASM licenses remain included. Ghostlink's own code is MIT.
2. Keep [live-wallet acceptance](../testing/live-wallets.md) and [the compatibility record](../testing/compatibility-v1.json) accurate. On 2026-11-20 the maintainer deferred the remaining live-wallet/protected-API and testnet transaction checks to a later pass and retained enabled transaction APIs for this beta. These checks remain outstanding and are not a publication gate for `0.1.0-beta.1`. Do not claim transaction certification or replace live evidence with provider fixtures.
3. Review current dependency advisories, including the website's separate dependency tree, before final release verification. Update the matching versions in the four manifests and Vue/React guide examples, refresh the lockfile, and update the changelog. Do not claim that a pre-release version or successful build satisfies the preceding prerequisites.
4. Confirm npm organization ownership, publishing rights and account 2FA. For the initial release, `viktor.albus` was verified as an owner of `ghostdagger`, 2FA was enabled, and the GitHub environment `npm-release` was created. No environment approval rule is assumed by this workflow; configure additional reviewers if desired.

## Local preparation and verification

Use the pinned Node version in `.node-version` and pnpm in `package.json`.

```sh
pnpm install --frozen-lockfile
pnpm audit
pnpm build
pnpm typecheck
pnpm test
pnpm test:release
pnpm exec playwright install chromium
pnpm test:browser
pnpm test:website
pnpm check:package --manager both
pnpm check:guides
pnpm release:dry-run
```

`check:package` prepares archives with `pnpm pack`, which converts workspace dependencies to publishable versions. It checks repeatable archive hashes, public metadata, MIT license inclusion, export files, packaged declarations, SSR, CSS/fonts/logos, SQLite and WASM verification, and browser isolation. It also produces `artifacts/release.json` with the source revision, source cleanliness, file lists and SHA-512 integrity, plus `SHA256SUMS`. Preparation from a dirty working tree is allowed for local review and recorded as such; those artifacts cannot be published by the workflow. Commit the intended source before preparing the actual release.

To test existing archives without repacking:

```sh
pnpm check:package --artifacts artifacts --manager both
pnpm check:guides --artifacts artifacts
pnpm release:verify --version 0.1.0-beta.2
```

The guide checker asserts that the documented npm versions match the release, then substitutes the verified local archives for dependency resolution. Application source comes from the guides. Archive consumers use local overrides; registry consumers use exact published versions with **no dependency overrides and no npm/GitHub credentials**, with fresh npm caches and pnpm stores. Registry verification waits for public install metadata and tarball availability, and checks the downloaded tarball hashes. npm may accept a publish before these endpoints are ready; authentication failures and integrity mismatches still fail immediately.

## Release workflow

For verification only, run **Verify and publish public SDK packages** from `main` (or another reviewed ref), enter the package version, and leave `publish` **false**. This runs all checks and uploads artifacts without creating a release tag or publishing. The workflow must be present on the default branch for manual dispatch.

For an actual release, create `sdk-vVERSION` at the reviewed commit, select that exact tag, and enter the same version. Publication requires that tag and `publish: true`; the first release instead uses the bootstrap below. Pushing commits or tags does not trigger publication.

The macOS verification job runs the workspace checks, browser and website suites, npm/pnpm archive consumers, guide flows and an npm publish dry run. It uploads the tested tarballs and manifest as `sdk-release`. The Ubuntu publishing job downloads and checks those exact files against the tag's source revision; it does not rebuild them. It checks that all four versions are absent, publishes core first under `candidate`, verifies anonymous registry metadata/integrity and clean npm/pnpm consumers, and then promotes all four packages. `X.Y.Z-beta.N` promotes to `beta`, `alpha.N` to `alpha`, `rc.N` to `rc`, and stable `X.Y.Z` to `latest`.

For a package’s very first publication, npm also assigns `latest`, even when `--tag=candidate` is supplied, and rejects removal of `latest` while published versions exist. The bootstrap therefore assigned both `beta` and `latest` to `0.1.0-beta.1`. Subsequent betas advance `beta` and preserve `latest`. Use explicit beta or version specifiers, and inspect all tags after publication. Later prereleases must preserve any existing stable `latest` version.

The first release requires the bootstrap below. Subsequent releases use `publish: true` after all prerequisites and npm trusted publishers are configured. Only the publishing job receives `id-token: write`; no npm write token is stored in GitHub.

## One-time npm bootstrap

npm requires each package to exist before a trusted publisher can be configured. Do not create placeholder packages. For the first release, verify the reviewed commit with `publish: false`, or use the successful **SDK verification** CI run. Tag that exact commit as `sdk-vVERSION` if it is not already tagged. Download `sdk-release` (or the `artifacts/` directory inside CI’s `ghostlink-artifacts`) to `artifacts/` in a **clean checkout of the same tag**, then verify it. The archive manifest and tag must identify the same clean source revision:

```sh
pnpm release:verify --version 0.1.0-beta.1
```

Use npm 11.21.3, matching the workflow. Sign in locally as an authorized `ghostdagger` publisher with 2FA. Complete npm’s browser authentication when requested; the optional five-minute publishing window does not cover every tag-management operation. Publish those reviewed archives under `candidate`, core first:

```sh
npm login --registry=https://registry.npmjs.org/
npm publish ./artifacts/ghostdagger-ghostlink-core-0.1.0-beta.1.tgz --registry=https://registry.npmjs.org/ --access=public --tag=candidate --ignore-scripts
npm publish ./artifacts/ghostdagger-ghostlink-server-0.1.0-beta.1.tgz --registry=https://registry.npmjs.org/ --access=public --tag=candidate --ignore-scripts
npm publish ./artifacts/ghostdagger-ghostlink-react-0.1.0-beta.1.tgz --registry=https://registry.npmjs.org/ --access=public --tag=candidate --ignore-scripts
npm publish ./artifacts/ghostdagger-ghostlink-vue-0.1.0-beta.1.tgz --registry=https://registry.npmjs.org/ --access=public --tag=candidate --ignore-scripts
node tools/check-packages.mjs --artifacts artifacts --registry-version 0.1.0-beta.1 --manager both
```

Only after those consumer checks pass, promote the initial release:

```sh
npm dist-tag add @ghostdagger/ghostlink-core@0.1.0-beta.1 beta --registry=https://registry.npmjs.org/
npm dist-tag add @ghostdagger/ghostlink-server@0.1.0-beta.1 beta --registry=https://registry.npmjs.org/
npm dist-tag add @ghostdagger/ghostlink-react@0.1.0-beta.1 beta --registry=https://registry.npmjs.org/
npm dist-tag add @ghostdagger/ghostlink-vue@0.1.0-beta.1 beta --registry=https://registry.npmjs.org/
```

Confirm all four `beta` tags with `npm dist-tag ls PACKAGE --registry=https://registry.npmjs.org/`. The locally published bootstrap has no GitHub OIDC provenance; later workflow publications include it. Keep bootstrap credentials on the publisher's machine and never place them in source, chat or release artifacts.

## npm trusted publishing

GitHub Actions trusted publishers use the label `Ghostlink SDK releases` and these settings for **all four packages**:

| Setting | Value |
| --- | --- |
| Organization/user | `ghostdagger-labs` |
| Repository | `ghostlink` |
| Workflow filename | `sdk-packages.yml` |
| Environment | `npm-release` |
| Allowed actions | Allow direct `npm publish` **and** `npm dist-tag` |

The workflow pins npm 11.21.3 to support OIDC for both publication and tag management. npm also grants `npm stage publish` automatically. Each connection is **Pending validation** until its first successful trusted publication. The original connections created on 2026-11-20 expired without publication; they must be recreated for beta.2. Their original deadlines were:

| Package settings | First successful publication before (UTC) |
| --- | --- |
| [Core](https://www.npmjs.com/package/@ghostdagger/ghostlink-core/access) | 2026-11-23 00:06 |
| [Server](https://www.npmjs.com/package/@ghostdagger/ghostlink-server/access) | 2026-11-23 00:09 |
| [React](https://www.npmjs.com/package/@ghostdagger/ghostlink-react/access) | 2026-11-23 00:13 |
| [Vue](https://www.npmjs.com/package/@ghostdagger/ghostlink-vue/access) | 2026-11-23 00:14 |

Configurations expire if not validated within two days of creation; recreate any expired connection near the next release using the settings above and check its new deadline in npm. Saving the connections does not validate the workflow. The bootstrap version already exists and must not be republished merely to exercise OIDC. After a successful trusted publication, restrict token-based publishing according to the organization's policy.

## Partial releases and recovery

Four-package publication and tag promotion are not atomic. A `candidate` package is public and installable by exact version immediately. If one publication, consumer check or promotion fails, stop and inspect all versions, integrity values and tags. Do not automatically skip existing versions, overwrite them, delete them, or rerun publication blindly. The workflow refuses an already-existing version. Use a new coordinated version for corrected artifacts; recover unchanged artifacts only after separately verifying their identity. Check all tags if promotion partially succeeded.

Publish the GitHub release notes after all packages pass registry checks and promotion. For the initial beta, the archives came from [successful CI run 44835640164](https://github.com/ghostdagger-labs/ghostlink/actions/runs/44835640164); the same commit also passed [release-tag verification](https://github.com/ghostdagger-labs/ghostlink/actions/runs/44836603647). Public downloads matched the tested archive hashes, and fresh-cache npm and pnpm consumers passed. The beta.2 automated release requires freshly recreated trusted publisher connections.

References: [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/), [npm trust prerequisites](https://docs.npmjs.com/cli/commands/npm-trust/), [pnpm workspace packaging](https://pnpm.io/workspaces#publishing-workspace-packages), [npm first-publication/latest behavior](https://github.com/npm/cli/issues/8490).
