# Deferred wallet integrations

Decision and research date: **2026-11-19**. These are feasibility findings, not shipped support or release commitments. External APIs and device limits must be checked again against pinned versions before implementation. No new wallet or hardware interoperability was tested during this investigation.

## Product decision

- The default SDK, Vue/React chooser, examples, onboarding links, and public website offer **KasWare and Kastle browser wallets only**.
- Mobile and hardware options remain hidden until they meet the UX and security requirements below. The website does not advertise prospective wallets as available or planned integrations.
- Kaspium's manual adapter and signing UI remain available only through explicit adapter configuration. The development-only `/manual.html` harness retains browser coverage; it is not included in the example production build or linked from the public demo.
- **Kaspire, Ledger, and KSPR** are candidates for later investigation.
- **Kuro is dropped.** The name came from the mockup; no verified Kaspa wallet project or integration API was identified. Historical design files remain preserved, but are not a support roadmap.
- **Tangem is out of scope** for now.

## Required user experience

For a desktop-to-phone login, the user selects the wallet, scans one QR code, reviews the wallet's approval prompts, and sees the originating browser finish signing in automatically. For a website opened on the phone, a button opens the wallet and the user can return to the browser without copying data. Separate wallet connection and login-signature approvals are acceptable when required by the wallet.

The normal flow must not require address entry, navigating advanced settings, copying a message or signature, uploading a signature image, or scanning a second QR code. Cancellation, expired pairing, a locked wallet, interrupted connectivity, and returning from the background need clear recovery without stale requests completing afterward. Pairing alone must never be presented as authenticated login.

Real-device evidence is required before exposing a candidate in the default chooser. Test desktop QR and same-phone flows independently. Whether the first automatic mobile release must support iOS, or may launch on Android first, is still undecided.

## Kaspire — first mobile candidate to evaluate

**Evidence:** The [mobile developer guide](https://kaspire.kaslab.space/developers) documents an Android WalletConnect v2 integration, a Reown project ID with allowed website origins, account retrieval, personal-message signing, an authentication method, and session lifecycle events. Its [versioned protocol documentation](https://github.com/KaspaHUB21/Kaspire-Kaspa-Wallet/blob/main/docs/walletconnect_protocol/README.md) describes a wallet-specific Kaspa namespace, including Mainnet and Testnet 10. These are published API candidates, not Ghostlink compatibility certification. The documented mobile route is Android; do not infer iOS support.

The guide uses the official SignClient with a canonical `wc:` pairing URI. Its desktop QR wraps that URI in the verified `https://kaspire.kaslab.space/kaspire/wc?uri=...` app link; Android launching uses the documented intent with an HTTPS fallback. The guide says Kaspire is not registered in Reown's generic wallet picker, so Ghostlink should provide its own dedicated wallet entry and QR presentation. The app link launches the wallet; requests and responses stay in the encrypted session.

**Before implementation or promotion:**

1. Pin and review the actual wallet/protocol version, distribution provenance, signing implementation, request schemas, error behavior, and required dependencies.
2. Build a login-only real-device prototype using the official WalletConnect SDK. Request only the accounts and methods needed for login. Do not advertise transfers or transaction signing based on their presence in documentation.
3. Verify that `kaspa_signPersonal` signs Ghostlink's exact message bytes with the expected Kaspa personal-message hash and Schnorr encoding. Independently evaluate `kaspa_signAuth`; its advertised domain binding is not proof of CAIP-122 conformance or compatibility with our message format.
4. Verify trusted-origin handling, account/network binding, stale-request cancellation, signature rejection, expiry, session deletion, account changes, reconnect, and mobile background/return behavior. A native authentication rejection must never fall back to generic signing.
5. Keep pairing secrets out of logs, analytics, URLs sent to unrelated services, and application persistence. Use SDK-owned transport and cryptography. Preserve the separation between a wallet connection and the backend login session.
6. Add pairing state to the controller and native Vue/React UI only after the end-to-end prototype meets the UX bar. A `walletconnect` adapter-kind type already exists, but no pairing transport, URI state, session negotiation, or implementation exists in Ghostlink today.

**Decision:** promising for a future Android prototype; hidden pending verification and a platform decision. No Reown project or external service was created.

## Ledger — authentication compatibility investigation

**Evidence:** Ledger's [Kaspa JavaScript implementation](https://github.com/LedgerHQ/ledger-live/blob/develop/libs/ledgerjs/packages/hw-app-kaspa/src/Kaspa.ts) exposes `signMessage`, documents a 120-byte limit for Nano S and 200 bytes for other devices, and encodes message length with a one-byte integer. The [device message handler](https://github.com/LedgerHQ/app-kaspa/blob/main/src/handler/sign_msg.c) reads that length and enforces its maximum. Ghostlink's [canonical v1 fixture](../../tests/fixtures/login-v1.json) is **449 UTF-8 bytes**, so the existing challenge cannot pass through the inspected interface unchanged. This is a protocol constraint, not a missing button.

Possible paths are upstream support for longer messages or a separately designed compact authentication profile. Neither has been implemented or proven. Start with login; device transaction signing is a separate integration and certification task.

Any compact profile must preserve the security of existing integrations:

- Keep the current v1 serializer and verifier unchanged. New formats need distinct identifiers, explicit server allowlists, exact serialization, versioned receipts, and tests preventing signatures from being accepted under a different profile.
- Retain binding to the application origin, account, network, login purpose, a cryptographically strong one-time nonce, and expiry, together with browser/CSRF binding and atomic replay prevention. Do not shorten or drop security fields merely to fit a device.
- The server must pin the profile when issuing the challenge. A client claiming to be Ledger is not evidence of device identity and cannot authorize weaker verification.
- No fallback after rejection or failed verification. Do not truncate a challenge, substitute an opaque digest, or silently reinterpret signatures under v1.
- Assess what the user can meaningfully review on the device. Cryptographic validity alone does not establish equivalent consent or phishing protection. Existing generic-signing routes also do not claim wallet-side trusted-domain enforcement.
- It is acceptable to support only device/app versions that meet the requirements; compatibility with every Ledger model is not a reason to weaken the profile.

After resolving the message format, evaluate supported browser transports, explicit device selection, address/account derivation and confirmation, disconnect behavior, and physical-device evidence. Prefer upstream long-message support if available. No device firmware changes or hardware tests were performed.

**Decision:** deferred feasibility work; do not advertise Ledger support or change other wallets' security policy.

## KSPR — identify and verify the integration surface

**Evidence:** A [Chrome Web Store listing named KSPR Wallet](https://chromewebstore.google.com/detail/kspr-wallet/bjjnnpilnbkodgfbmdlgbhkknfhglfac) advertises dApp connectivity. At inspection it listed version 1.0.5 and publisher `cmbeth`. The listing alone does not establish publisher provenance, a documented signing API, wallet-side security behavior, or mobile QR pairing. No usable provider contract or source-backed mobile transport was verified in this investigation.

Treat the browser extension, web wallet, and Telegram bot as distinct products. The prototype's “Mobile · pairing via QR” description is unverified and must not be carried into implementation or marketing.

Before building an adapter, establish the official project, publisher and maintained distribution; obtain its provider documentation or inspect the actual implementation; verify permissioned account access, exact-message signing, signature format, account/network events, rejection, and session restoration. Confirm login on a real wallet and record the version. Never require private-key or seed import into Ghostlink, or substitute Telegram identity for proof of control of a Kaspa account.

A verified injected provider could support the normal browser-wallet experience without mobile pairing. Evaluate that route independently. Mobile support additionally requires a documented wallet-supported protocol and the one-scan/automatic-return UX above.

**Decision:** research candidate only; no adapter or public support claim.

## Kaspium and Tangem disposition

Kaspium manual signing has existing user-reported login evidence, but requires address entry, its advanced Sign message tool, and manual signature return. It does not meet the default UX bar. Retain [the opt-in integration instructions](../integration/kaspium.md), core authentication tests, and the dedicated browser harness. Reconsider visibility only when a verified wallet-supported communication flow removes those steps.

Tangem remains out of scope. Findings to retain if it is revisited: its [documented WalletConnect networks](https://tangem.com/en/help-center/dapps-ai-agents/dapps-walletconnect/) do not include native Kaspa, and its [Kaspa address implementation](https://github.com/tangem/blockchain-sdk-kotlin/blob/master/blockchain/src/main/java/com/tangem/blockchain/blockchains/kaspa/KaspaAddressService.kt) uses ECDSA addresses, which [Ghostlink v1](../protocol/kaspa-authentication-profile-v1.md) rejects. A card-tap UI would also require an appropriate native bridge; [Web NFC](https://developer.chrome.com/docs/capabilities/nfc) does not expose low-level card operations. No Tangem implementation is planned by this decision.

## Reopening an integration

Start with the unresolved API/protocol question, then demonstrate the desired UX using a real wallet. Record exact versions and distinguish source inspection, automated fixtures, and real-wallet observations in the [compatibility record](../testing/compatibility-v1.json). Follow the [adapter requirements](../integration/wallet-adapters.md) and [live acceptance procedure](../testing/live-wallets.md). A future implementation needs explicit supported platforms and capabilities, reviewed UI, failure-path coverage, and independent signature verification before enabling its public entry.
