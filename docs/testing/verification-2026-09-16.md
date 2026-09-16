# Implementation verification — September 16, 2026

The four SDK packages and Vue showcase are implemented. Package publication remains separate. Real-wallet evidence is maintained in [compatibility-v1.json](compatibility-v1.json), with the [remaining live procedure](live-wallets.md).

## Automated results

- Node 24.16.0 and pnpm 11.7.0: workspace production build and strict typechecking pass.
- Vitest: 63 passing tests for exact messages, official signature vectors, key/address correspondence, browser binding, CSRF, replay, concurrent verification, SQLite persistence/atomicity, session expiry/revocation, cancellation, adapter APIs and transaction precision.
- Playwright: 23 passing Chromium tests for login, manual QR/paste, wrong signatures/expiry, cancellation, signing-only separation, multi-tab revocation, native Vue/React, accessibility, focus, origin redirect, network handling and reviewed visual baselines.
- After the final manual-signing instructions and address-error recovery changes, five targeted Chromium tests passed, including a new invalid-checksum → edit address → valid challenge regression. The suite now contains 24 tests; the full-suite count above precedes that additional regression.
- Production dependency audit: no reported advisories on September 16, 2026. This is an advisory-database check, not an independent security audit.
- Packed consumer: all four tarballs install in a fresh project; Vue/React SSR, strict NodeNext declarations, CSS, packaged fonts/wallet logos, official WASM signature verification and Node SQLite pass. Browser bundles contain no server runtime. Repacking produces identical tarball hashes in `artifacts/SHA256SUMS`.

## Live findings incorporated

KasWare 0.10.0 Mainnet login is user-confirmed. Kastle 2.60.0 Mainnet/Testnet 10 login and network switching are user-confirmed. Kastle's versioned source lacks a Testnet 11 network entry; invoking that route crashes its popup. The adapter blocks that unsupported route and the SDK treats Testnet 10 as its own explicit chain.

The development entry point redirects localhost navigation to the configured 127.0.0.1 origin, preserving strict backend origin checks. Manual address entry tolerates grouping whitespace before challenge creation; the official SDK still validates the checksum. A copied `a` in place of `q` was correctly rejected. Exact login-message bytes are never repaired or truncated.

Kaspium 1.3.0 Mainnet manual flow was subsequently confirmed by the user. No session receipt was retained at the subsequent lookup; its evidence is user-reported. All three documented wallets now have user-reported live login evidence. Protected API observations and real testnet transaction evidence remain pending. No provider test double counts as live wallet evidence, and no automated test spends mainnet funds.

The user confirmed that the KasWare Testnet 11 and Kastle Testnet 10 accounts are unfunded. Live transfer and funded signing-only verification remain pending test KAS; successful login does not certify these transaction capabilities.
