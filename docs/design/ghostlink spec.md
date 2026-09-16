# Ghostlink implementation specification — revision 1

Updated September 16, 2026. This revision supersedes the original draft, retained verbatim in [archive/ghostlink spec.original.md](archive/ghostlink%20spec.original.md). The unmodified [Design Prototype](Ghostlink%20UI/Ghostlink%20Prototype.html) remains the source of truth for UI styling and interaction surfaces. Protocol and security behavior follow this specification, the [v1 authentication profile](../protocol/kaspa-authentication-profile-v1.md), and the actual documented wallet APIs.

## Scope and package boundaries

Ghostlink is a strict TypeScript SDK on Node 24, built in a pnpm workspace. `ghostlink-core` owns framework-neutral state, adapters, authentication transport, presentation functions and scoped CSS. `ghostlink-vue` and `ghostlink-react` provide native components and lifecycle bindings. `ghostlink-server` owns official Kaspa verification, Web HTTP handlers, a Node adapter, sessions and durable SQLite storage. The Vue/Vite showcase and its Node backend live in `examples/vue`. Packages ship ESM, declarations, separate styles, local fonts and their required runtime assets. Server-only code must stay outside browser bundles; public imports must be SSR safe.

Other frameworks, edge runtimes, a marketing website, npm publication and production WalletConnect pairing remain deferred. Prepared npm tarballs are local artifacts, not a claim of publication.

## Authentication policy

Existing wallets can authenticate using their existing generic message-signing interfaces. Ghostlink enforces exact challenge serialization, trusted application origin/login URI, network/account binding, browser binding, nonce expiry, official signature verification, address/key correspondence, atomic replay prevention and revocable sessions.

These server checks do **not** make generic signing phishing-resistant. Automatic trusted-domain rejection inside the wallet is a separate capability. KasWare, Kastle and manual Kaspium integration are compatibility routes and must not be presented as fully CAIP-122 wallet-side compliant. Capability metadata identifies a chosen integration route; it is not cryptographic evidence of wallet identity.

CAIP-122 alignment is the preferred future direction. Provide a versioned proposed Kaspa profile, canonical fixtures and conformance tests. Prefer a verified native `signIn` route and trusted wallet-side origin comparison when available. A native authentication rejection or failed security check must never downgrade to generic signing. Keep compatibility adapters available explicitly. The provisional `kaspa` namespace is not represented as registered; a future profile migration requires new identifiers/serializers, explicit allowlists and versioned receipts.

Native addresses, proposed CAIP-10 account IDs and CAIP-2 chain IDs are separate types of identifier. The proposed profile uses a prefixless account segment; restore `kaspa:` for mainnet and `kaspatest:` for Testnet 10 and Testnet 11. Address prefix alone cannot distinguish Kaspa testnets. Message serialization includes the account segment and a separate chain field, with exact UTF-8 bytes and no trailing newline.

Initially accept only standard Schnorr public-key addresses. Use the official Kaspa SDK for checksum/address operations, personal-message hashing and Schnorr verification. Verify that the signing key derives the challenged native address. For a standard manual signing address, obtain the x-only public key with the official address-to-key operation. Reject unsupported address/signature types. Pin and distribute the official artifact with provenance, checksums and license. Store profile-versioned internal authentication receipts; defer interoperable CACAO until a Kaspa profile is defined and tested. No independent audit is claimed.

## Controller and adapters

`createGhostlink(config)` accepts application metadata, network, adapters and authentication endpoints. Public methods include `connect`, `authenticate`, `disconnect`, `restoreSession`, `signMessage`, `signTransaction`, `sendTransaction`, `getSnapshot`, `subscribe`, and `destroy`. UI helpers include `open`, `close`, `back`, `prepareAuthentication`, `confirmRequest`, network selection and balance refresh. Results, capabilities and failures are typed.

Core separates authentication from live wallet connectivity. It serializes approvals, cancels stale generations, checks account/network before and after wallet responses, invalidates observed wallet changes, and propagates invalidation between tabs. Local sign-out is immediate; failed server revocation remains pending and is retried without claiming success. A new login waits for pending revocation. Offline browsers, closed tabs and manual signing cannot continuously monitor wallet state.

KasWare uses its injected request/accounts/network/public-key APIs and generic Schnorr message signing. Kastle uses its injected connect/account/network and message APIs. Transaction capabilities are individually detected, not required for login. Providers may reject or lack functionality; errors must be truthful, not simulated success. Kastle 2.60.0 supports Mainnet and Testnet 10; its Testnet 11 switch screen crashes. Keep Testnet 10 explicit and distinct from Testnet 11, and reject the unsupported Kastle route before opening a prompt. Maintain the versioned compatibility matrix and record actual tested versions separately from source/API inspection.

Kaspium is manual authentication: select the wallet, enter the actual signing address, issue a browser-bound challenge, show its complete message and a real QR, sign through Kaspium's QR/paste input, return its signature by paste/QR, and verify on the same backend. Never ask for key export. Stay within the wallet's 2,000-character message limit and never truncate. Expired challenges are replaced. QR codes contain message/signature text, never invented pairing URIs. Restored Kaspium login is an application session without live connectivity; automated transactions are unavailable and logout revokes that application session.

## Transaction boundaries

Normalize actual APIs instead of imposing proposed method names. Separate wallet-managed transfer, native Kaspa transaction JSON signing and PSKT JSON signing. Format tags are mandatory. `signTransaction` must never broadcast or call a send method. `sendTransaction` is explicitly a wallet-approved transfer and broadcast. Do not infer interchangeability between JSON representations.

Use integer sompi throughout the SDK. Reject precision-losing conversion before invoking a provider accepting JavaScript numbers. Capture request parameters before displaying review and recheck the selected account/network before invoking the wallet. The wallet presents final transaction inputs, outputs, change and fees. A confirmed exploitable operation must be blocked until a corrected integration is verified; unaffected login can remain available.

Future WalletConnect work must use canonical `wc:` URIs and SDK-owned protocol/cryptographic operations. No custom relay encryption or `kaspa-wc:` scheme is part of this implementation.

## Server defaults

`createGhostlinkServer()` exposes Web `Request`/`Response` handling and `getSession()` for protected routes. `createNodeHandler()` adapts Node HTTP. Default prefix is `/auth/ghostlink` with challenge, verify, session and logout endpoints. Configure trusted origin, login URI and supported networks explicitly.

Defaults: five-minute challenges, 256-bit random nonces, 30-second future-issued skew, opaque hashed session tokens, 24-hour absolute and 30-minute idle session expiry. Challenge consumption and session creation are atomic. Production cookies are HttpOnly, Secure, SameSite=Lax, host-only and Path=/. Responses cannot be cached. Require same-origin requests, browser-bound CSRF protection, bounded bodies and rate limiting. Insecure HTTP is allowed only through an explicit loopback development configuration.

SQLite is durable and owns its migrations. An asynchronous storage contract and reusable conformance checks permit future alternatives, but no non-atomic implementation is acceptable. The security guide defines reverse-proxy, protected-route and storage responsibilities.

## UI, branding and example

Match prototype typography, spacing, surfaces, borders, radii, cards and transitions. Keep review, message confirmation, pending, failure, onboarding and session details surfaces. Remove prototype navigation, simulated outcomes/balances, device switches and relay-debug chrome. Render only actual detected wallets/capabilities and real application information. Show authenticated success only after server verification. Final signature/transaction approval takes place in the wallet.

The connect button follows the supplied references: wallet icon and label before authentication; wallet branding and shortened address after it. Clicking authenticated state opens session details. Kaspium extends the prototype's QR/message/account/input treatments with necessary, clearly labelled manual signing steps. Functional QR codes use a complete quiet zone and high-resolution image source instead of the prototype's fake QR.

Use Lucide UI icons and source-verified wallet assets. Extract prototype colors and body/heading/monospace fonts into `--ghostlink-*` tokens with dark/light presets. No global reset or runtime font-service dependency. Provide Vue slots/React render props, keyboard trapping/restoration, Escape, accessible labels/announcements, reduced motion and responsive scrolling.

The Vue example uses public APIs. It defaults to testnet-11, offers Mainnet and Testnet 10 with reauthentication on change and remembers the selected network across reloads, shows real session/account/network/expiry and balance where available, calls a protected backend route, signs messages, accepts supported signing-only payloads, and presents an explicit transfer form with destination, amount and fee. No automatic broadcasts or prefilled mainnet recipient. Palette/font overrides are demonstrated. Mocks belong only in tests or clearly identified development harnesses.

## Verification and release gates

Use Vitest for protocol, controller, cryptographic, replay, CSRF, storage, concurrency, cancellation, expiry, precision and downgrade tests. Use Playwright for browser flows, QR/paste, provider changes, restoration, multiple tabs, accessibility, keyboard, React/Vue consistency and prototype comparisons. Test clean tarball installation, exported declarations, CSS/fonts/WASM assets and SSR imports.

Automated tests use public fixture keys and never spend mainnet funds. Record real wallet versions and login evidence independently. Every advertised transaction capability requires actual testnet signing/transaction evidence. Passing provider doubles is not sufficient. A release must have reproducible packages, integration/theming/security documentation, passing checks, and verified login on documented KasWare, Kastle and Kaspium versions. Missing real-wallet evidence remains an explicit release blocker; it must not be filled with invented results.
