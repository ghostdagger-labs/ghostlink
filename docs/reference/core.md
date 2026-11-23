---
description: "Configuration, controller methods, snapshots, adapters, transports, protocol utilities, and presentation helpers."
updated: '2026-11-23'
api:
  "@ghostdagger/ghostlink-core": ["createGhostlink","Ghostlink","GhostlinkConfig","GhostlinkSnapshot","AuthSession","AuthChallenge","AuthTransport","WalletAccount","WalletAdapter","WalletDescriptor","WalletCapabilities","TransactionRequest","TransactionFormat","TransferRequest","GhostlinkError","ErrorCode","FlowStep","InitializationState","AuthenticationListener","createAuthClient","defaultAdapters","kaswareAdapter","kastleAdapter","kaspiumAdapter","PROFILE","NETWORKS","Network","ChainId","LoginMessageFields","chainId","addressPrefix","accountId","isNetwork","serializeLoginMessage","parseLoginMessage","parseKasAmount","formatKas","shortenAddress","getPresentation","remainingTime","createMessageQr","scanQrImage","scanQrCamera","trapDialogFocus"]
---
# Core API

## Entry point and configuration

Import from `@ghostdagger/ghostlink-core`. `createGhostlink(config)` returns a `Ghostlink` controller; the class is also exported. Prefer the factory in application code.

| `GhostlinkConfig` property | Default / contract |
| --- | --- |
| `app.name`, `app.url` | Required application name and absolute HTTP(S) URL; URL origin must match the backend |
| `app.icon` | Optional icon URL shown during review |
| `network` | `testnet-11` |
| `adapters` | KasWare and Kastle; an explicit array replaces the defaults; IDs must be unique |
| `auth` | Same-origin transport at `/auth/ghostlink`; accept custom transport or `{ baseUrl, fetch }` |
| `closeOnAuthenticate` | `true`; only a fresh verified login closes automatically |

Construction validates configuration but performs no browser discovery or network activity. Keep one stable instance per provider lifetime and one per SSR request.

## Ownership and observation

| Method | Returns | Contract |
| --- | --- | --- |
| `attach()` | `() => void` | Acquire browser activity; returned release is idempotent and preserves established sessions |
| `getSnapshot()` | `GhostlinkSnapshot` | Read-only current state; do not mutate nested values |
| `subscribe(listener)` | `() => void` | Subscribe to state changes; listener takes no arguments, read the snapshot |
| `onAuthenticated(listener)` | `() => void` | Fresh verified login only; receives read-only session; promises are not awaited |
| `destroy()` | `void` | Permanently retire the instance and cancel work; later operations reject with CANCELLED |
| `refreshWallets()` | `void` | Refresh availability/capability metadata without requesting account permission |

## Authentication and networks

| Method | Returns | Contract |
| --- | --- | --- |
| `connect(walletId?)` | `Promise<void>` | No ID opens selection; an ID connects that wallet, revoking an existing session; does not authenticate |
| `prepareAuthentication(address?)` | `Promise<void>` | Prepare a challenge; manual adapters accept the address here |
| `authenticate({ address?, signature? }?)` | `Promise<Readonly<AuthSession>>` | Prepare if needed, sign or accept a manual signature, then verify |
| `restoreSession()` | `Promise<void>` | Recheck identity without prompting or emitting fresh-login listeners |
| `disconnect()` | `Promise<void>` | Clear local state and request revocation; inspect revocationPending |
| `setNetwork(network)` | `Promise<void>` | Change application network and sign out when different |
| `switchWalletNetwork()` | `Promise<void>` | Request the selected wallet's network switch if supported |
| `refreshBalance()` | `Promise<void>` | Update bigint sompi balance; null means unavailable, not zero |

## Wallet requests and UI control

`signMessage(message): Promise<string>` signs 1–2000 characters. `signTransaction(request): Promise<string>` signs tagged native JSON without broadcasting. `sendTransaction(request): Promise<string>` signs and broadcasts a transfer and returns its ID. Each needs a verified session, current matching provider state, and the corresponding capability. Read [Signing and transfers](../concepts/transactions.md).

`open()`, `close()`, `back()`, and `showWalletHelp()` control the supplied presentation flow. Closing cancels pending local work, but cannot close extension prompts or undo a broadcast.

Custom modal renderers can acquire `attachUI()` and release its returned callback on teardown. While a request is in the review state, `confirmRequest()` continues it to the wallet. Keep one modal host per client and preserve accessible review/cancel actions.

## Snapshot and related types

`GhostlinkError` extends Error with a string `code` and a displayable `message`. Expected rejection and cancellation still reject the operation promise; handle them in your application.

`GhostlinkSnapshot` is nested-readonly in TypeScript; its top-level object is also frozen at runtime.

| Fields | Meaning |
| --- | --- |
| `initialization`, `initializationError` | idle/restoring/ready/error; independent from operation errors |
| `session`, `authentication` | Verified metadata and authentication progress; wait for ready |
| `account`, `connection`, `walletId` | Last-known provider identity, connection state, and chosen adapter |
| `network`, `wallets` | Application network and discovered `WalletDescriptor` records |
| `open`, `step`, `busy`, `request` | Presentation state, approval serialization, and active request review |
| `challenge`, `error` | Login challenge and most recent wallet-operation failure |
| `balance`, `revocationPending` | Bigint sompi or null; unconfirmed backend logout |

`WalletAccount` contains address, network, and optional public key. `AuthChallenge` contains id, profile, exact message, address, network, and expiry. `AuthSession` contains verified identity and expiration metadata, never a cookie token.

`ErrorCode`, `FlowStep`, `InitializationState`, `AuthenticationListener`, `TransactionFormat`, `TransactionRequest`, `TransferRequest`, `WalletCapabilities`, `WalletDescriptor`, `WalletAdapter`, and `AuthTransport` are exported types. Read the [errors reference](errors.md), [session guide](../concepts/sessions.md), and [adapter contract](../integration/wallet-adapters.md) for their behavior.

## Adapters and transport

`kaswareAdapter()`, `kastleAdapter()`, and `kaspiumAdapter()` construct adapters. `defaultAdapters()` returns KasWare and Kastle only.

`createAuthClient({ baseUrl?, fetch? }?)` implements `AuthTransport` with same-origin cookies, no-store requests, and CSRF bootstrapping. Its `challenge(account)` and `verify(input)` return a challenge and session; `session({ signal }?)` returns a session or null; `logout()` revokes the session. A custom transport must preserve the documented server trust boundaries.

## Protocol and amount helpers

| Export | Contract |
| --- | --- |
| `PROFILE` | `ghostlink-kaspa-v1` |
| `NETWORKS`, `Network`, `ChainId`, `isNetwork(value)` | Supported names and runtime narrowing |
| `addressPrefix(network)`, `chainId(network)` | Address prefix and network-qualified chain ID |
| `accountId(address, network)` | Basic prefix/character validation and network-qualified identifier; not checksum verification |
| `serializeLoginMessage(fields)` | Canonical login text for `LoginMessageFields` |
| `parseLoginMessage(message, context)` | Strict profile parsing with origin, network, and expiry checks; not signature verification |
| `parseKasAmount(decimalString)` | Nonnegative bigint sompi; at most eight decimals; rejects signs, spaces, and exponents |
| `formatKas(sompi)` | Exact decimal KAS string without trailing fractional zeroes |
| `shortenAddress(address)` | Display abbreviation only |

## Presentation helpers

`getPresentation(snapshot, app)` derives modal labels/rows; its results do not authorize an application action. `remainingTime(expiresAt, now)` formats minutes and seconds.

`createMessageQr(message)` returns a PNG data URL containing the exact message. `scanQrImage(file)` decodes an image. `scanQrCamera(video, onResult)` returns a promise for a stop callback; release camera resources on teardown. `trapDialogFocus(event, dialog)` supports keyboard wrapping in a native dialog.

Import styles through `@ghostdagger/ghostlink-core/styles.css`, optional fonts through `fonts.css`, and licensed wallet assets through `assets/*`.
