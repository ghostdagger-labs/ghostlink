# Landing page reconciliation and recommended roadmap

The preserved `docs/design/landing page/Ghostlink Landing.dc.html` governs layout, styling, and interaction. It is not evidence that the proposed protocols, packages, integrations, or product claims exist. The initial audit was on 2026-09-16; wallet visibility and priorities were updated on 2026-11-19 under the [deferred integration decision](wallet-integrations.md).

## Claims and replacements

| Prototype claim | Current evidence / limitation | Published replacement |
| --- | --- | --- |
| Connect any Kaspa wallet in four lines | `packages/ghostlink-core/src/adapters.ts` implements three login routes; backend configuration is required | Kaspa wallet login for your dApp |
| `@ghostlink/sdk`, `@ghostlink/react`, `new Ghostlink`, `projectId`, `useSession`, `useGhostlinkSigner`, `openGhostlinkModal`, `GhostlinkButton`, `outputs`/decimal transfer amounts | Real exports are `ghostlink-core`, `ghostlink-vue`, `ghostlink-react`, `ghostlink-server`; `createGhostlink`, provider components, and `useGhostlink` are documented in README. Transfers use bigint sompi | Typechecked TypeScript/Vue/React examples using real exports; explicit backend/provider prerequisite |
| Public npm install and simulated “copied” success | Registry publication is separate; local tarballs are verified by `tools/check-packages.mjs` | Package coming soon; both installation controls unavailable |
| Four methods, six adapters, 11kB gzipped, no dependencies | `types.ts` defines a capability-based adapter interface; two default adapters and an opt-in manual adapter exist; core depends on QR/scanning libraries | Two browser wallets, two UI integrations, typed APIs |
| “Adapters shipped” includes KSPR, Tangem, Ledger, Kuro, Zelcore, Kasper Markets, Sompi Pay, DAGStore, Blockshelf | No corresponding adapters or adoption evidence | Marquee contains only KasWare and Kastle |
| KasWare and Kastle Stable; Kastle mobile integration | Compatibility record documents browser login evidence but incomplete protected-API and real transaction certification | Supported, explicitly browser-extension login |
| KSPR Stable, Tangem Beta, Ledger Planned | None has an implemented adapter | Hidden; future findings are internal documentation, not public commitments |
| Kaspium mobile pairing | `kaspiumAdapter` is manual and requires explicit configuration; the UX does not meet the default mobile bar | Hidden from the default chooser and website; manual development harness retained |
| Pairing topic, symmetric key, pairing URI, TTL and deep links | No relay transport, automatic pairing, or deep-link protocol is implemented | Choose a wallet; review/sign; backend verification |
| Namespace negotiation, declared methods/events and grantable account permissions | Current protocol verifies an explicit login challenge; it does not negotiate WalletConnect namespaces | Review the application, account and network in the login message |
| Settled session, seven-day expiry, automatic relay reconnect, weekly approvals | `server.ts`: configurable sessions default to 24 hours with 30-minute idle expiry; challenge lifetime is five minutes. Backend authentication and provider connectivity are distinct | Sessions restore if still valid; server expiry and revocation apply |
| Every app rewrites 2,000 lines; four wallet APIs; adapters take 100 lines | No measured evidence for effort estimates | Qualitative comparison grounded in existing APIs and UI |
| Compile-time rejection of every unsupported wallet method | Networks/errors are typed; wallet capabilities are runtime checks | Typed APIs with runtime capability checks |
| Retheme with exactly six variables | `styles.css` exposes more scoped tokens; headless controller and native UI exist | Scoped CSS variables for fonts, colors and surfaces |
| Every failure has a dedicated screen, including relay failures | Shared error presentation covers typed failures; no relay exists | Clear feedback for rejection, expiry, network mismatch and verification failure |
| Demo exposes nine states and relay log | `examples/vue` exercises real authentication, protected requests and wallet operations | Working Vue example; no simulated state count or relay log |
| Preview says installed/relay active and lists KSPR | These are fabricated state indicators | Illustrative preview: KasWare/Kastle Extension; descriptive preview badge |
| MIT licensed and open source | No project-level license exists in the repository; third-party assets retain their own licenses | Pre-release; source repository link; no licensing claim |
| “Built with it: Kasper” | No verified adoption evidence | Source code link |
| Docs / brand / demo `.dc.html` destinations | These prototype routes do not form the production site | `/docs` placeholder and `/demo` working example |

## Recommended roadmap

These are recommendations, not release promises. Landing-page copy must change only when completion evidence exists.

### Priority 1 — Distribution and documented confidence

- **Package publication and licensing (absent):** choose and add the project license, populate package metadata, publish the existing package names, and verify installation from the registry in clean Vue, React and Node consumers. Only then enable a real installation command and licensing claims.
- **Compatibility acceptance (partially verified):** extend the versioned compatibility record with protected-API evidence, supported-network tests, rejection/expiry/logout behavior, and funded testnet transaction results. Keep manual login separate from automated wallet capabilities; do not infer certification from fixtures.
- **Documentation (placeholder):** publish setup, backend origin configuration, authentication lifecycle, framework integration, Kaspium manual signing, theming and capability limitations. Replace the placeholder once these instructions reproduce a working integration.

### Priority 2 — Additional wallet and mobile support

- **Additional adapters (absent):** retain Kaspire, Ledger and KSPR as research candidates under the [integration findings](wallet-integrations.md). Kuro is dropped because its name came only from the mockup; Tangem is out of scope. Completion requires verified APIs, capability detection, provenance, fixtures, real-wallet evidence and the agreed UX before exposing a wallet publicly.
- **Mobile transport evaluation (absent):** Kaspire has a documented Android pairing candidate, but no Ghostlink interoperability evidence. Require one scan plus wallet approvals and automatic completion, or an app link on the same phone. Evaluate expiry, cancellation, reconnect and background return. Manual Kaspium signing remains opt-in and hidden by default.
- **Permission negotiation (absent):** evaluate actual wallet support for scoped chains, accounts, methods and events. Define and verify enforcement on both sides before advertising a negotiated namespace model.

### Priority 3 — Measured performance and session experience

- **Bundle measurements (unverified):** publish reproducible compressed-size measurements per package and representative integration, with dependency and lazy-loading boundaries. Do not claim zero dependencies.
- **Session UX (implemented, with different semantics):** document configurable absolute/idle expiry and restoration independently from live wallet connectivity. Longer sessions or automatic reconnect require an explicit product/security decision; seven days is not an implementation target merely because the prototype says so.

## Permitted visual differences

- Truthful copy changes line wrapping, headline length, statistic width, code-panel height and section heights. Containers, typography, color tokens, spacing, card geometry and section order remain derived from the prototype.
- Tabs read TypeScript / Vue / React; snippets are longer where real APIs require it. The prerequisite note replaces the unsupported “whole integration” claim.
- Coming-soon installation controls retain their original shapes and colors, but have no copy action or false success feedback.
- Wallet badges, preview rows and marquee content reflect actual support. Prototype monograms remain decorative identifiers, not fabricated official logos or installed state.
- Functional icons use Lucide at the original footprints. The Ghostlink mark and three decorative diagrams retain their geometry.
- Narrow layouts use a single column when the prototype's minimum grid widths overflow; the header navigation wraps below its branding/actions. Headings reduce only on small screens.
- Light-mode green badge text uses `#2D7857` instead of `#2F7D5B`, and preview badge text uses the existing secondary-text token: the prototype combinations fell just below WCAG AA contrast. Backgrounds and other palette tokens remain unchanged.
- Keyboard focus, a focus-only skip link, accessible names, and reduced-motion support are added. Repeated marquee copies are hidden from assistive technology; motion pauses on hover/focus.
- The docs placeholder borrows the same shell and tokens. The actual demo retains its existing SDK styling, isolated from the landing page.

## Validation record

See `website/README.md` for commands. Browser tests cover both themes at 360, 390, 768 and 1280 pixels, capture full-page evidence, check accessibility and navigation, and exercise the Nuxt authentication adapter using fixture signatures. Automated wallet fixtures are not additional live-wallet certification.

### Browser-only visibility verification — 2026-11-19

- Workspace build and typecheck passed, along with 71 unit tests, 33 example browser tests, and 21 website tests. The optional Docker restart test was skipped.
- Default Vue/React choosers contain KasWare and Kastle with All/Installed tabs; the website demo's onboarding links match. Public landing-page assertions reject mobile/hardware wallet names and claims.
- Existing manual Kaspium browser checks pass through the explicit `/manual.html` development harness; that entry is absent from the production example build.
- Chooser and landing-page screenshot baselines were updated for the intentional visibility/copy changes. Desktop and narrow layouts were visually reviewed; accessibility, overflow and Vue/React parity checks passed.
- Authentication verification is unchanged. No additional live-wallet certification or deployment was performed.

### Completed verification — 2026-09-16

- Preserved reference and implementation inspected in dark/light desktop and mobile layouts. Header, hero grid, typography, card surfaces, controls and illustrations compared; responsive and content differences are documented above. Four reviewed screenshot baselines retained for future changes.
- Eight theme/viewport combinations passed axe accessibility and document-overflow checks.
- Production Docker image passed the 17 website behavior/appearance checks, including all three login routes and cleanup of provider subscriptions on client navigation.
- A verified fixture session survived container restart and still authorized a protected request; the image reports healthy with the vendor verification WASM present.
- Existing 63 SDK tests and 29 standalone Vue/React browser tests passed. Workspace build, typecheck, raw snippet typecheck, clean-consumer installation, SSR, asset isolation and package checks passed.
- No public deployment or additional live-wallet certification was performed.
