# Wallet adapter guide

Implement the exported `WalletAdapter` contract and pass instances to `createGhostlink({ adapters })`. Discovery must be synchronous and SSR safe. Fetch wallet state through documented provider APIs; do not inspect extension storage or request seed phrases. Do not request account permissions until the user selects the wallet.

`connect(network)` returns one selected address, network, and optional public key. `getAccount()` reads already shared state without a new permission prompt. Normalize provider errors to `GhostlinkError`; user rejection must stay rejection. Subscribe to account changes, network changes and disconnect and remove every subscription when disposed. Missing transaction capabilities must not prevent login. Never infer a supported network from unknown provider network names.

For native authentication, prefer the [proposed profile](../protocol/kaspa-authentication-profile-v1.md). Declare `authentication: 'caip122'` only after implementing and testing a trusted-origin authentication path; this flag selects `signIn` with no automatic fallback. `domainBinding: 'conformance-tested'` requires recorded wallet-side testing. A generic `signMessage` implementation is a compatibility integration even when Ghostlink serializes CAIP-style fields.

## Required wallet conformance record

Use isolated test accounts and record wallet build/version, browser/OS, provider API version, exact test message and signature, network and address, result, date and source revision. Never record private keys or seed phrases. Test:

1. Canonical fixture parses and its signature verifies with the official SDK; derive the key's address and match it.
2. Present the same message from a different origin, port and scheme. Record whether the **wallet** rejects before signing. Server rejection is a different assertion.
3. Reject expired/not-yet-valid messages, CRLF, trailing bytes, duplicate/unknown fields, and account/network mismatch in a native authentication route.
4. Reject or cancel native authentication and prove no generic signature request follows.
5. Change the selected account/network while an approval is pending. The cancelled response must not authenticate.
6. For every advertised transaction format, sign a valid testnet transaction, inspect outputs/change/fee, verify signatures, and prove the signing call did not broadcast. Only an explicit transfer/broadcast test may submit to testnet. Record its transaction ID and explorer/RPC confirmation.
7. Check denial, unavailable capabilities, provider lock/disconnect, events, reconnect, and version detection.

Use the repository's fixture and controller tests as an executable contract. Add adapter-specific integration tests with provider doubles under `tests/` only. Source inspection establishes an API candidate; it does not establish real-wallet interoperability or wallet-side security behavior. Update `docs/testing/compatibility-v1.json` only with evidence.

## Existing routes

KasWare: `window.kasware.requestAccounts/getAccounts/getPublicKey/getNetwork`; `signMessage(message, { type: 'schnorr' })`; `signPskt({ txJsonString })`; `sendKaspa(address, integerSompi, { priorityFee: integerSompi })`. Kastle: `window.kastle.connect/getAccount/getNetwork`; `signMessage(message)`; `signTx(network, serializedTransaction)`; `sendKaspa(address, integerSompi, { priorityFee })`. KasWare network names are `kaspa_mainnet`, `kaspa_testnet_10`, and `kaspa_testnet_11`; Kastle 2.60.0 uses `mainnet` and `testnet-10`. Its published API page lists Testnet 11, but the versioned implementation has no such switch-screen entry and crashes. Ghostlink rejects Kastle Testnet 11 connection/switch requests before invoking the provider. Revisit this guard only after a corrected wallet version is verified. Calls are capability-detected. Safe-integer bounds are checked before converting sompi to provider numbers.

Transaction JSON and PSKT JSON are explicitly tagged and never coerced into each other. Native wallet approval is the final authority over transaction inputs, outputs and fees. Ghostlink rejects unsupported formats and never implements a signing-only operation using a broadcasting method. A confirmed exploitable wallet operation must be disabled until a corrected version is verified; retain unaffected login functionality.

Kaspium is a manual adapter. In version 1.3.0, Settings → Advanced → Sign message opens the required tool; its message-field QR button accepts arbitrary message text. The home-screen scanner expects payment/address data and rejects login-message QR codes. Its source provides message input through QR/paste and signature output through QR/copy. Ghostlink displays a real message QR and accepts a signature QR or paste. It never constructs a fake pairing URI. No provider exists for automated transaction requests in this integration. Offline/manual signing cannot continuously monitor wallet state.

Future WalletConnect integrations must use the official SDK's canonical `wc:` URI, session lifecycle and encryption. Do not invent a `kaspa-wc:` protocol or copy protocol cryptography. Production pairing remains deferred pending verified compatible wallets.

Sources: [KasWare provider](https://github.com/kasware-wallet/extension/blob/main/src/content-script/pageProvider/index.ts), [Kastle API](https://docs.kastle.cc/readme/how-to-integrate/kastle-wallet-api), [Kastle signing implementation](https://github.com/forbole/kastle/blob/main/components/screens/browser-api/kaspa/sign-tx/SignTx.tsx), [Kaspium signing screen](https://github.com/azbuky/kaspium_wallet/blob/main/lib/sign_message/sign_message_sheet.dart).

Kastle network evidence: [2.60.0 network definitions](https://github.com/forbole/kastle/blob/v2.60.0/contexts/SettingsContext.tsx), [switch-screen lookup](https://github.com/forbole/kastle/blob/v2.60.0/components/screens/browser-api/kaspa/SwitchKaspaNetwork.tsx), and the recorded live popup failure in the compatibility matrix.
