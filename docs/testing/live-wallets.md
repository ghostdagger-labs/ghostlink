# Real-wallet acceptance

The compatibility matrix is a versioned evidence record, not a marketing list. Empty `testedWalletVersions` / `liveLogin` / `testnetTransactions` fields mean validation is outstanding. Automated provider fixtures are explicitly identified as test doubles and never count as live evidence.

## Prerequisites

The default example and website demo expose browser wallets only. Kaspium testing requires the explicit `/manual.html` development harness or [adapter opt-in](../integration/kaspium.md), following the [2026-11-19 visibility decision](../roadmap/wallet-integrations.md).

Run `pnpm build && pnpm dev`, open http://127.0.0.1:5173 in the browser containing the extension, and select Testnet 11 for KasWare or Testnet 10 for Kastle in both the application and wallet. Mainnet login is valid acceptance evidence but does not replace testnet transaction testing. Use a wallet account dedicated to testing. For Kaspium 1.3.0, open Settings → Advanced → Sign message and use the QR button inside its message field (the home-screen payment scanner does not accept login-message QR codes); never export private keys. Record the exact extension/mobile version from its own About/settings screen, platform, browser version and date. Wallet version strings supplied to dApps are only hints.

## Login acceptance for each wallet

For browser wallets, include a first-time connection that opens the wallet's approval popup. After approval returns focus to the browser, Ghostlink must remain on **Review session**, ready to continue signing in without choosing the wallet again. Connection alone must still leave `/api/private` unauthorized until the login signature is verified.

1. Start signed out and confirm `/api/private` denies access. Choose the wallet, inspect the application domain, network and signing account, and approve the login message. For Kaspium, enter the selected signing address, scan/copy the exact message into Sign message, and return its signature through paste and through QR upload/camera in separate runs.
2. Confirm the backend returns a session for the expected address and chain and the account card appears. Close/reopen session details, reload, and call “Test protected API.” Record the canonical message, public account/signature, result and wallet version locally. Do not include session cookies, CSRF tokens, seed phrases or private keys in reports.
3. Reject a login; change account/network during approval; let a challenge expire; sign with a different Kaspium address. None may produce an authenticated session. For extensions, change account/network after login and verify both local UI and backend session invalidate.
4. Log out, retry the protected request, and check another tab also signs out. Test offline logout and verify the UI reports pending server revocation until connectivity returns. For manual signing, record that no live provider is connected.
5. From an isolated second test origin, request a message naming the first. Record whether the wallet itself rejects or merely displays the text. Do not mark wallet-side domain enforcement as tested based on Ghostlink's server rejection.

## Transaction evidence

For every enabled transaction capability, construct a valid transaction on the wallet's supported testnet with the official SDK and test account UTXOs. Native JSON and PSKT have different representations; use the wallet's declared format. Review every input, output, change address and fee. For signing-only, verify the returned signatures independently and confirm no broadcast occurred. Record serialized format, wallet/version, network and results. Do not use `{}` or fixture transactions from browser tests as real transactions.

For wallet-managed transfers, explicitly enter a recipient on the same testnet under your control and a small test amount. Inspect the final wallet fee and confirm once. Record the real transaction ID, outputs and successful testnet RPC/explorer lookup. Test user rejection separately and confirm no transaction was sent. There are no automated mainnet spend tests or prefilled mainnet recipients.

Record evidence under `docs/testing/evidence/` after redacting bearer session information, then reference it from `compatibility-v1.json`. Do not claim the transfer or signing capability is certified before this evidence exists. Kaspium manual integration advertises no automated transaction capability.

## Release checklist

- Exact deployed wallet versions have verified login evidence for KasWare, Kastle and Kaspium.
- Every advertised transaction capability has real testnet evidence.
- Unsupported signatures/types are rejected and confirmed vulnerabilities disable affected operations.
- Build, strict typecheck, Vitest, Playwright, visual comparisons and packed-consumer checks pass.
- Dependency and asset provenance/license records are reviewed; no unsupported security audit claim appears.
- Package names/version/license and publishing authorization are decided before a separate publication step.

KasWare 0.10.0 and Kastle 2.60.0 Mainnet logins were confirmed by the user on September 16, 2026, with screenshots in `evidence/`. Kastle 2.60.0 Testnet 10 login and switching between Mainnet/Testnet 10 were also confirmed after the adapter correction. Kaspium 1.3.0 Mainnet manual flow was confirmed by the user. No session receipt was retained at the subsequent evidence lookup, so this record is user-reported. Protected API results and testnet transaction evidence remain outstanding. The Kastle Testnet 11 popup crash is recorded and guarded; use Testnet 10.

Until live-wallet evidence is filled, the SDK remains a pre-release integration candidate.

On September 16, 2026, the user confirmed that neither the KasWare Testnet 11 account nor the Kastle Testnet 10 account has test KAS. Live transfer and funded signing-only tests are pending funding. The [Kaspa testnet documentation](https://wiki.kaspa.org/en/testnets) lists the [Testnet 11 faucet](https://faucet-tn11.kaspanet.io/) and [Testnet 10 faucet](https://faucet-tn10.kaspanet.io/); faucet availability and funding have not been verified. Copy each wallet's receiving address while it is on the corresponding testnet. Both testnets use `kaspatest:` addresses, so the prefix alone does not identify which testnet to fund. Login, protected API, restoration and logout tests do not require a balance.
