# Authoring the website documentation

The website publishes an explicit set of repository Markdown files. `website/tools/docs-manifest.ts` maps each source to its route, short navigation label, and group; array order defines previous/next navigation. Existing integration guides retain their original paths and executable `guide-file` blocks. Design exports, archived specifications, roadmaps, and this authoring guide are not published automatically.

## Write or update a page

1. Edit the canonical Markdown file, or add a new file and manifest entry. Do not copy the prose into a Vue component.
2. Include YAML frontmatter with a concise `description` and quoted ISO `updated` date reflecting the last substantive review. Keep exactly one H1 for the article title; H2/H3 headings populate the contents list.
3. Use GitHub-flavored Markdown: ordinary links, nested lists, tables, fenced code, and `[!NOTE]` / `[!WARNING]` blockquotes. Embedded HTML is deliberately not rendered. Use real relative repository links; the compiler rewrites published documents to website routes and other repository files to GitHub. File paths containing brackets or spaces can be URL encoded.
4. Keep snippets complete enough to typecheck. Mark new standalone TS/TSX/Vue examples with `<!-- docs-check: unique-filename.ts -->` immediately before their fence. The checker compiles them in a temporary directory with the current package declarations. Existing complete Vue/React guide files continue to use their separate `guide-file` harness.
5. Reference pages list their documented public symbols in `api` frontmatter, grouped by import entry point. `check:docs` verifies each name resolves and appears in the page body. Explain contracts, defaults, errors, and ownership in prose; a valid import alone does not establish behavioral truth.

For example:

```yaml
---
description: "What the reader will learn or accomplish."
updated: '2026-11-23'
api:
  '@ghostdagger/ghostlink-core': [createGhostlink, GhostlinkConfig]
---
```

The compiler derives title, GitHub-compatible heading IDs, read time, UTF-8 byte count, HTML, raw Markdown, navigation, and full-text search from the same input. It preserves exact raw Markdown, including frontmatter and test comments. Do not hand-edit `.nuxt`, `.output`, or `node_modules/.cache/nuxt` artifacts.

## Preview and checks

Use Node 24 and the repository's pinned pnpm version:

```sh
pnpm check:docs
pnpm --filter ghostlink-website typecheck
pnpm build:website
pnpm dev:website
pnpm test:website
pnpm check:package --manager pnpm
pnpm check:guides
```

Use the URL printed by the preview server. A running server may already own the configured port. Production builds prerender the registered docs pages; the demo and authentication endpoints remain dynamic. Development watches the registered Markdown files and reloads on changes. Restart Nuxt after changing the manifest or compiler.

`pnpm check:docs` validates metadata, local links/fragments, symbol imports, and tagged examples, and tests sanitization, tables, lists, callouts, and publication boundaries. It needs built workspace package declarations. `check:package` prepares verified release archives; `check:guides` then extracts and tests the full Vue/React walkthroughs against those archives in development and production.

To check new examples against extracted **published** archives, verify each archive against its npm registry integrity, extract to `<directory>/{core,vue,react,server}/package`, and run:

```sh
GHOSTLINK_DOCS_PACKAGES=/absolute/path/to/verified-archives pnpm check:docs
```

Generated examples are compiled, never executed by this check; examples that connect to databases or send transfers cannot trigger those actions during typechecking.

## Release and evidence updates

The website describes one published release. Verify the registry and actual archives before changing `website/app/data/release.ts`. Update pinned install commands, complete guide manifests, API references, and examples together. Keep package versions matched and rerun the release/archive checks.

Use declarations to verify the API surface, implementation and tests for behavior, and dated compatibility records for wallet claims. Do not promote source-reviewed provider capabilities to live-wallet certification. Review origin/network constraints, session defaults, revocation semantics, supported entry points, and migration ownership on each release.

Visual baselines are reviewed against the preserved design before acceptance. Browser tests cover both themes and mobile/tablet/desktop layouts. Corrected content and expanded navigation may change page length; typography, geometry, surfaces, and control treatments should continue to match the reference. See the [reconciliation record](roadmap/documentation-page-reconciliation.md).
