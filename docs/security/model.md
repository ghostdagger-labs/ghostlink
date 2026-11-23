---
description: "Understand challenge verification, cookie sessions, revocation, storage guarantees, and application responsibilities."
updated: '2026-11-23'
---
# Security model and deployment

Ghostlink verifies control of a supported Kaspa account and establishes a revocable application session. A connection approval alone never authenticates. Signature verification binds the intended application, browser, account and network and prevents replay. **Generic message signing is not phishing-resistant**: an attacker can relay a legitimate challenge to a victim and persuade them to sign it. Wallet-side trusted-domain enforcement is a separate, preferred protection. Do not describe existing compatibility adapters as fully CAIP-122 compliant.

## Server boundaries

- Configure one exact trusted HTTPS `origin`, a same-origin `loginUri`, and an explicit network allowlist. The example's HTTP exception is opt-in and loopback only. Trust neither forwarded headers nor caller-supplied domains. The Node adapter requires the configured Host; a reverse proxy must preserve it and supply the correct public origin in configuration.
- POST endpoints require exact Origin, JSON content type, a browser-binding cookie and matching 256-bit CSRF token. Reject cross-site Fetch Metadata. Endpoints are same-origin; no credentialed cross-origin CORS. Session GET establishes the browser binding and supplies the CSRF token in its non-cacheable JSON body.
- Challenges expire in five minutes, with 256-bit random nonce/ID and at most one outstanding challenge per browser. Verify the stored bytes, official address checksum/type and signing key before atomic consumption. Expiry is checked again inside the database transaction.
- Session cookies contain random 256-bit tokens. Store SHA-256 token hashes, never their bearer values. Production cookies use `__Host-`, Path=/, Secure, HttpOnly, SameSite=Lax and no Domain. Absolute lifetime is 24 hours, idle lifetime 30 minutes; server session lookup touches idle activity without extending absolute expiry. Login rotates and invalidates the previous browser session; logout invalidates sessions and pending challenges for that browser.
- Requests are bounded to 16 KiB. Default limits are 180 endpoint requests per trusted peer per minute and 30 POST requests per browser per minute. Use trusted ingress limits as well; do not derive peer identity from arbitrary `X-Forwarded-For`. Web-handler callers may pass a trusted `ip`; without it, the peer bucket is shared. Authentication responses use `Cache-Control: no-store`.

`getSession(request)` retrieves a server-verified session for protected routes. It does not authorize application-specific operations and does not supply CSRF protection for your own mutations. Apply your application's origin, CSRF, permission, validation and rate-limit rules to those routes. XSS on the trusted application origin can act with its session; HttpOnly cookies do not prevent that. Apply CSP and ordinary application security controls.

## Client lifecycle

Authentication and live connectivity are separate state fields. Kaspium and a restored backend-only session may be authenticated without an automated wallet connection. Signing requires both a valid server session and a current matching provider account/network. Re-read provider state around each approval and invalidate on observed wallet changes/disconnects.

Approval requests are serialized. Cancellation invalidates a generation token; late responses cannot complete cancelled logins. Cancelling an authentication challenge requests server revocation, including any session created by a racing verify. Closing a dialog cannot cancel an extension's own already-open prompt or undo an already submitted transaction. A later provider call must wait until the old call settles.

BroadcastChannel carries only invalidation messages between same-origin tabs. No tokens/signatures travel through it. Only the selected adapter ID is saved in localStorage as a restoration hint. On focus, restore from the backend; never restore authentication from localStorage. Provider IDs, flags and versions are untrusted integration metadata.

Revocation failure immediately clears local authenticated UI and sets `revocationPending`; retries occur on connectivity/focus/lifecycle ticks. A new login waits for successful revocation. Never claim that a server session was revoked while offline. An offline, closed or manual-signing browser cannot provide continuous monitoring; server expiry remains authoritative. Background browser throttling may delay local timers.

## Storage, runtime and maintenance

`createSqliteStorage(path)` owns schema version 1 through SQLite `user_version`; it refuses unknown future versions. WAL, foreign keys, transactions, a busy timeout and private database file permissions are enabled. Back up the database using SQLite's consistent backup facilities, including WAL state; restrict access to database files and receipts. Do not place the database on a filesystem without reliable SQLite locking. Custom stores implement the asynchronous contract and must pass `assertStorageConformance` against an isolated database, including atomic consumption and revocation.

`createPostgresStorage(pool)` supports writable-primary `pg` and Neon pools. Run `migratePostgresStorage` separately with a migration role; use a dedicated schema/database per app and environment and restricted runtime credentials over TLS. Browser-row locks and READ COMMITTED transactions serialize challenge replacement, login, and logout across instances. A failed session insert rolls back challenge consumption and rotation. Atomic session activity updates cannot resurrect revoked rows, and atomic counters enforce shared rate limits. Do not authorize from replicas or cached session objects. Storage failures fail closed; uncertain login commits are not automatically retried. The host owns asynchronous pool shutdown. See [Postgres deployment and tests](../integration/postgres.md).

Neither storage adapter requires private wallet keys. IndexedDB/localStorage cannot replace authoritative challenge, session, revocation, and rate-limit state. Browser storage remains limited to untrusted restoration hints. Managed Postgres lets serverless developers avoid operating a database server while preserving these boundaries.

The official Kaspa v2.0.1 WASM runtime is vendored with checksums and its ISC license. `node:sqlite` requires the declared Node 24 runtime; no edge-runtime support is claimed. No independent audit of Ghostlink has been performed. Dependency review, threat modeling, adversarial tests and real-wallet conformance are release gates, not substitutes for an external audit. Report confirmed vulnerabilities privately to the repository owner and disable affected operations pending remediation.
