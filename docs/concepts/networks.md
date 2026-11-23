---
description: "Choose a supported network and distinguish runtime capabilities from recorded real-wallet compatibility."
updated: '2026-11-23'
---
# Networks and wallet capabilities

## Configure a network

Ghostlink accepts `mainnet`, `testnet-10`, and `testnet-11`. The core defaults to Testnet 11; the server defaults to allowing all three. Set these explicitly in an application so users know which network they are using.

Mainnet addresses begin with `kaspa:`; both testnets use `kaspatest:`. The address prefix alone cannot distinguish Testnet 10 from Testnet 11.

`client.setNetwork(network)` signs out the current session when the application network changes. `switchWalletNetwork()` asks a capable provider to change its own network; it is a separate action.

## Default browser adapters

| Wallet | Networks accepted by Ghostlink | Signing-only format | Transfer API |
| --- | --- | --- | --- |
| KasWare | Mainnet, Testnet 10, Testnet 11 | `pskt-json` | `sendKaspa` |
| Kastle | Mainnet, Testnet 10 | `kaspa-transaction-json` | `sendKaspa` |

The default chooser includes only KasWare and Kastle. Provider methods are detected at runtime; availability is not permission to access an account.

Kastle 2.60.0's Testnet 11 switch screen failed in the recorded live check. Ghostlink rejects that route before invoking the wallet. A future wallet release must be verified before this guard changes.

## Read capabilities

Each discovered wallet exposes `messageSigning`, `transactionFormats`, `transfer`, `authentication`, and `domainBinding`. Use these to decide which actions to offer. The controller still rechecks identity and capability when an action runs.

A missing transaction capability must not block login. `authentication: 'compatibility'` means generic message signing. A custom native `caip122` adapter must implement `signIn`; failures do not silently fall back to generic signing.

## What has been verified

The [compatibility record](../testing/compatibility-v1.json) records wallet versions, dates, source reviews, and live evidence. It includes KasWare 0.10.0 and Kastle 2.60.0 browser login evidence from September 16, 2026. It does not establish completed real testnet transaction certification.

Automated provider fixtures exercise Ghostlink behavior but are not real-wallet certification. No evidence of wallet-side domain enforcement or independent audit is implied by the capability flags.

## Optional and future adapters

Kaspium is a manually configured message-signing integration. It is absent from `defaultAdapters()` and the public demo, and provides no automated transaction provider. Read the [adapter guide](../integration/wallet-adapters.md) before opting in.

WalletConnect pairing, mobile deep links, and additional wallet adapters are not supplied by this release.
