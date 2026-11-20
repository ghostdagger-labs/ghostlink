# Public SDK releases

Source: `ghostdagger-labs/ghostlink` on GitHub. Registry: `https://registry.npmjs.org/`. npm organization: `ghostdagger`. The first prepared version is **0.1.0-beta.1**; it has not been published by this setup work.

| Package | Role |
| --- | --- |
| `@ghostdagger/ghostlink-core` | Framework-neutral client, adapters, styles and assets |
| `@ghostdagger/ghostlink-server` | Node 24 verification, handlers and SQLite sessions |
| `@ghostdagger/ghostlink-react` | React 18.3/19 UI |
| `@ghostdagger/ghostlink-vue` | Vue 3.5 UI |

All four advance together. The three dependent packages resolve the exact core release. Packages are ESM and public on npm; consumers do not need a GitHub account, token or GitHub registry configuration. The workspace root, website and example remain private package manifests and are never published.

## Before the first publication

GitHub ownership and visibility are configured as of 2026-11-20: the existing repository was transferred to `ghostdagger-labs/ghostlink`, made public, and the local `origin` updated. Gitleaks 8.30.1 found no credentials in the 12 committed revisions checked before the visibility change. The release workflow deliberately refuses other repositories, and its publishing job requires public source for npm provenance.

1. Resolve the KasWare/Kastle logo redistribution prerequisite in [third-party notices](../../THIRD_PARTY_NOTICES.md). Preserve font and WASM licenses. Ghostlink's own code is MIT.
2. Complete the applicable [live-wallet release checklist](../testing/live-wallets.md) and update [the compatibility record](../testing/compatibility-v1.json). Protected-API evidence and real testnet transaction evidence are outstanding in the current record. Validate advertised transaction capabilities or remove them from the initial release scope. Do not replace live evidence with provider fixtures.
3. Review current dependency advisories, including the website's separate dependency tree, before final release verification. Update the matching versions in the four manifests and Vue/React guide examples, refresh the lockfile, and update the changelog. Do not claim that a pre-release version or successful build satisfies the preceding prerequisites.
4. Confirm npm organization ownership and publishing rights, enable account 2FA, and create the GitHub environment `npm-release`. No environment approval rule is assumed by this workflow; configure additional reviewers if desired.

## Local preparation and verification

Use the pinned Node version in `.node-version` and pnpm in `package.json`.

```sh
pnpm install --frozen-lockfile
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
pnpm release:verify --version 0.1.0-beta.1
```

The guide checker asserts that the documented npm versions match the release, then substitutes the verified local archives for dependency resolution. Application source comes from the guides. Archive consumers use local overrides; registry consumers use exact published versions with **no overrides and no npm/GitHub credentials**.

## Release workflow

For verification only, run **Verify and publish public SDK packages** from `main` (or another reviewed ref), enter the package version, and leave `publish` **false**. This runs all checks and uploads artifacts without creating a release tag or publishing. The workflow must be present on the default branch for manual dispatch.

For an actual release, create `sdk-vVERSION` at the reviewed commit, select that exact tag, and enter the same version. Publication requires that tag and `publish: true`; the first release instead uses the bootstrap below. Pushing commits or tags does not trigger publication.

The macOS verification job runs the workspace checks, browser and website suites, npm/pnpm archive consumers, guide flows and an npm publish dry run. It uploads the tested tarballs and manifest as `sdk-release`. The Ubuntu publishing job downloads and checks those exact files against the tag's source revision; it does not rebuild them. It checks that all four versions are absent, publishes core first under `candidate`, verifies anonymous registry metadata/integrity and clean npm/pnpm consumers, and then promotes all four packages. `X.Y.Z-beta.N` promotes to `beta`, `alpha.N` to `alpha`, `rc.N` to `rc`, and stable `X.Y.Z` to `latest`.

The first release requires the bootstrap below. Subsequent releases use `publish: true` after all prerequisites and npm trusted publishers are configured. Only the publishing job receives `id-token: write`; no npm write token is stored in GitHub.

## One-time npm bootstrap

npm requires each package to exist before a trusted publisher can be configured. Do not create placeholder packages. For the first release, run the workflow from the reviewed `sdk-vVERSION` tag with `publish: false`, download its `sdk-release` artifact to `artifacts/` in a **clean checkout of the same tag**, then verify it:

```sh
pnpm release:verify --version 0.1.0-beta.1
```

Sign in to npm locally as an authorized `ghostdagger` publisher with 2FA. Publish those reviewed archives under `candidate`, core first:

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

## Configure npm trusted publishing

For **each of the four packages**, add a GitHub Actions trusted publisher in its npm settings:

| Setting | Value |
| --- | --- |
| Organization/user | `ghostdagger-labs` |
| Repository | `ghostlink` |
| Workflow filename | `sdk-packages.yml` |
| Environment | `npm-release` |
| Allowed actions | Allow direct `npm publish` **and** `npm dist-tag` |

The workflow pins npm 11.21.3 to support OIDC for both publication and tag management. Current npm trusted publisher configurations must complete a successful publish within two days of creation; configure them near the next release, or recreate an expired configuration. The bootstrap version already exists and must not be republished merely to exercise OIDC. After a successful trusted publication, restrict token-based publishing according to the organization's policy.

## Partial releases and recovery

Four-package publication and tag promotion are not atomic. A `candidate` package is public and installable by exact version immediately. If one publication, consumer check or promotion fails, stop and inspect all versions, integrity values and tags. Do not automatically skip existing versions, overwrite them, delete them, or rerun publication blindly. The workflow refuses an already-existing version. Use a new coordinated version for corrected artifacts; recover unchanged artifacts only after separately verifying their identity. Check all tags if promotion partially succeeded.

Publish the GitHub release notes after all packages pass registry checks and promotion. Changing this setup does not publish packages, create the organization, transfer the repository, open its source, or configure npm account settings.

References: [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/), [npm trust prerequisites](https://docs.npmjs.com/cli/commands/npm-trust/), [pnpm workspace packaging](https://pnpm.io/workspaces#publishing-workspace-packages).
