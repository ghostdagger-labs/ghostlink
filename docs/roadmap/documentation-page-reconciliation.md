# Documentation page reconciliation

Reviewed on November 23, 2026. The preserved `docs/design/documentation page/Ghostlink Docs.dc.html` governs the visual treatment, not SDK behavior or permission to execute its examples. Its original HTML and runtime remain untouched.

## Content corrections

| Design example | Published documentation | Evidence |
| --- | --- | --- |
| `@ghostlink/sdk`, framework packages, Nuxt module | Four matching `@ghostdagger/ghostlink-*` beta.2 packages; Nuxt uses the Vue binding | Published npm metadata and declaration archives; package manifests |
| WalletConnect sessions, relay, pairing URI | Browser wallet connection followed by a verified application cookie session | Core controller/adapters; server/auth-client implementations |
| `connect()` resolves a settled session | No ID opens selection; an ID connects a wallet; `authenticate()` returns verified metadata | Controller declarations and tests |
| Seven-day sessions and `extend()` | Configurable 24-hour absolute / 30-minute idle defaults; five-minute challenges | Server configuration and tests |
| Numeric errors, `userMessage`, `isGhostlinkError` | Exported `GhostlinkError` with string `ErrorCode` and displayable `message` | Core types and packaged declarations |
| Decimal transfer amounts / outputs builder | Native tagged JSON for signing; bigint sompi transfers for broadcasting | TransactionRequest, TransferRequest, adapter checks |
| Six `--gl-*` tokens, derived fixed state colors | Scoped public `--ghostlink-*` tokens; variables supplied to button and portaled modal | Core styles and existing theming guide |
| KSPR adapter and automatic mobile pairing | KasWare/Kastle defaults; advanced opt-in manual Kaspium; no relay transport | Adapter source, integration policy, compatibility record |
| Node 18, 11 kB, zero dependencies | Node 24 backend and declared framework peers; no unmeasured bundle claims | Published package manifests and verifier packaging |
| Demo needs no wallet and shows a relay log | Real `/demo` requires a supported wallet for verified login | Existing website demo and tests |

The four beta.2 archives were retrieved from npm and their SHA-512 integrity matched registry metadata. The docs checker compiled 10 new examples and resolved 70 public symbols against those extracted declarations. These checks establish example/API compatibility, not real-wallet transaction or security certification.

Supporting repository sources: [core declarations](../../packages/ghostlink-core/src/types.ts), [controller and defaults](../../packages/ghostlink-core/src/controller.ts), [controller behavior tests](../../packages/ghostlink-core/src/controller.test.ts), [adapters](../../packages/ghostlink-core/src/adapters.ts), [cookie transport](../../packages/ghostlink-core/src/auth-client.ts), [server policy](../../packages/ghostlink-server/src/server.ts), [server tests](../../packages/ghostlink-server/src/server.test.ts), [theme variables](../../packages/ghostlink-core/src/styles.css), and [dated wallet evidence](../testing/compatibility-v1.json). The registry sources are the published [core](https://www.npmjs.com/package/@ghostdagger/ghostlink-core/v/0.1.0-beta.2), [Vue](https://www.npmjs.com/package/@ghostdagger/ghostlink-vue/v/0.1.0-beta.2), [React](https://www.npmjs.com/package/@ghostdagger/ghostlink-react/v/0.1.0-beta.2), and [server](https://www.npmjs.com/package/@ghostdagger/ghostlink-server/v/0.1.0-beta.2) packages.

## Visual implementation

The reader retains the reference's maximum 1460px width, 26px column gaps, compact sticky header, Sora/Figtree/JetBrains Mono fonts, dark/light palettes, navigation highlight, article hierarchy, code bars, callouts, tables, contents rail, contribution/demo cards, and previous/next cards.

Intentional adaptations:

- Six navigation groups and 24 real articles replace the eight fictional sample pages. The long navigation and contents rails scroll independently within the viewport.
- Source-backed copy, maintained review dates, the published beta badge, calculated reading time, and exact UTF-8 raw-source size replace fabricated values.
- Code uses the existing site's build-time syntax colors within the reference's code surfaces and typography.
- Real links, heading permalinks, clipboard feedback, search results/retry feedback, and focus indicators replace simulated controls. The search index loads on demand.
- At tablet widths, contents move into a disclosure above the article. Below 768px, navigation uses a native modal drawer, with a non-JavaScript disclosure fallback. Edit/source/demo links remain available below the article.
- Semantic Markdown tables and lists, accessible focus and keyboard behavior, and reduced-motion support replace prototype-only markup.
- Secondary light-theme labels and warning labels are slightly darker to meet WCAG text contrast against their tinted surfaces.

No SDK API, wallet behavior, deployment credentials, or database schema is changed by the documentation rebuild.

## Implementation verification

- Node and Vercel preset production builds prerendered all 24 registered articles. No deployment was performed.
- Workspace typechecks passed. `check:docs` passed six compiler/validation tests and checked 70 public symbols and 10 examples against integrity-verified published beta.2 declarations.
- The production website suite passed 44 tests, including 18 documentation tests. All 18 documentation tests also passed in Nuxt development mode. The dedicated Docker restart check was skipped because no test container was selected.
- The existing Vue/React guide harness passed all 24 development/production tests against verified release archives. The pnpm clean-package consumer checks and 111 unit tests passed.
- Eight documentation screenshot baselines were reviewed: Installation at 390/1280/1460 pixels and Core API at 1280 pixels, each in both themes. Additional 360/768 checks passed. The docs accessibility scans reported no axe violations.
- All 24 source downloads matched their canonical Markdown byte-for-byte. Unknown pages returned 404. Documentation requests made no authentication calls or cookies; the isolated preview had created no SQLite file after docs-only traffic.
- Nitro's raw imports preserve code such as `import.meta.hot` inside the compiled article data. Browser regressions compare the complete Vue/React Markdown views with their source files to catch bundler substitutions.
- Development checks verified `/docs` returns 200 without a trailing-slash redirect and a temporary Markdown edit appears in server-rendered HTML through the watcher. The temporary edit was removed.
