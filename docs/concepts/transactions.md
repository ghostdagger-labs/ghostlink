---
description: "Request message signatures, sign native transaction payloads, and distinguish approval from broadcasting."
updated: '2026-11-23'
---
# Signing and transfers

## Before requesting a wallet action

Authenticate first, then require a live matching provider account and network. The controller checks identity around approvals, serializes approval requests, and rejects unsupported capabilities.

A restored backend session alone is insufficient for automated wallet signing. Connect the wallet again when necessary and complete login for that account.

## Sign a message

`client.signMessage(message)` returns a signature string after wallet approval. Messages must contain 1–2000 characters. This is an application signing operation; use `authenticate()` for Ghostlink login instead.

When a modal host is attached, Ghostlink also presents an application review before opening the wallet approval. A headless app owns its equivalent review.

## Sign a transaction without broadcasting

`signTransaction()` accepts a tagged native payload, not an outputs builder:

| Property | Requirement |
| --- | --- |
| `format` | `pskt-json` or `kaspa-transaction-json`, supported by the selected wallet |
| `payload` | Serialized transaction JSON, no more than 1,000,000 characters |
| `network` | Must match the authenticated network |
| `address` | Must match the current wallet account |

Build a valid payload using the appropriate wallet/Kaspa tooling. Ghostlink does not convert between transaction formats or substitute a broadcasting call for a signing-only call. The result is the wallet's signed serialized transaction string.

## Transfer KAS

`sendTransaction()` asks the wallet to sign **and broadcast**, and returns a transaction ID. Use integer bigint sompi: 100,000,000 sompi equals 1 KAS.

<!-- docs-check: transfer.ts -->
```ts
import { parseKasAmount, type Ghostlink } from '@ghostdagger/ghostlink-core';

// Call only after your UI has reviewed the recipient, network, amount, and fee.
export async function sendReviewedTransfer(client: Ghostlink, recipient: string) {
  return client.sendTransaction({
    toAddress: recipient,
    amountSompi: parseKasAmount('0.25'),
    priorityFeeSompi: 0n,
  });
}
```

The amount must be positive and the optional priority fee nonnegative. Values must fit provider safe-integer limits. Never calculate decimal KAS amounts using floating-point multiplication.

## Rejection and cancellation

User rejection is an expected outcome. A concurrent approval can produce `BUSY`. An account/network change invalidates the operation. Cancellation prevents late results from updating the current lifecycle; it cannot reverse a transaction already broadcast by a wallet.

Do not automatically repeat a transfer after a timeout or ambiguous result. Check the wallet's transaction history and network state first.

> [!WARNING]
> Real testnet transaction validation is still pending in the recorded compatibility evidence. Enabled APIs and automated fixtures do not establish real-wallet transaction certification. Use isolated test accounts and review the [compatibility record](../testing/compatibility-v1.json).

## Next

See [Core API](../reference/core.md) for method contracts and [Errors](../reference/errors.md) for recovery guidance.
