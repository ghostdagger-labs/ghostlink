# Provider lifecycle and session readiness

Put `GhostlinkProvider` or the Vue app plugin near the application root. It owns initialization and active browser resources. Hooks, custom triggers, and the supplied connect button all observe the same lifecycle; rendering a button is never required to restore a session.

## Ownership

| Action | Effect |
| --- | --- |
| Mount a provider / mount an app using the Vue plugin | Acquire an attachment, discover wallets, and check the backend session without requesting wallet approval. |
| Mount another owner of the same client | Share its activity and any pending initialization. |
| Release an owner | Release only its attachment. |
| Release the final owner | Remove timers, browser/wallet listeners and broadcast channels; cancel pending work and close the UI. Keep the established backend session. |
| Remount a borrowed client | Reacquire resources and recheck identity before reporting readiness. |
| `disconnect()` | Explicitly sign out, including server revocation. `revocationPending` reports an offline revocation. |
| `destroy()` | Permanently retire the instance. Further attachment, restoration and approval calls reject with `CANCELLED`. |

The caller creates the client; providers borrow it and never call `destroy()`. Keep its identity stable for the provider's lifetime. Deliberate replacement uses a keyed remount (`key={clientKey}` in React or `:key="clientKey"` in Vue). Passing another client to an existing provider throws an actionable error. Network changes use `setNetwork()` on the existing instance.

Each consumer still unsubscribes its own `subscribe()` or `onAuthenticated()` callbacks. Hooks handle their own subscriptions automatically. Releasing one provider never removes a different consumer's callbacks.

React effect cleanup releases an attachment and is reversible, including Strict Mode replay. Do not call terminal `destroy()` from a reusable effect cleanup. Once the last attachment and application references are gone, ordinary framework teardown needs no extra destruction call to avoid active-resource leaks. A bootstrap owner can explicitly destroy a retired client during HMR or other final teardown.

Pending wallet prompts may remain open in the extension after cancellation; Ghostlink cannot close them. Their late results cannot update the cancelled lifecycle. Approval calls remain serialized until the outstanding request settles. A cancelled authentication verification is revoked after a late successful response before a new owner can restore it. Established sessions are preserved during ordinary provider cleanup.

Final release aborts pending HTTP session reads. Custom `AuthTransport.session` implementations can accept the optional `{ signal }` argument to cancel their own I/O. Transports that ignore cancellation remain compatible; their stale results are ignored.

## Readiness

`initialization` is independent of wallet connection and authentication:

| Value | Meaning |
| --- | --- |
| `idle` | Not checked in the current lifecycle, or the final attachment was released. |
| `restoring` | Checking the backend session and existing wallet state. |
| `ready` | The check resolved, or an explicit login/sign-out resolved identity. `session === null` now means signed out. |
| `error` | Identity could not be checked. Read `initializationError` and offer retry. |

A previous session can remain in the snapshot during restoration or after a failed check. Treat it as last-known information until `initialization === 'ready'`. Route guards must wait for readiness; network failure is not proof that the user signed out. Server handlers remain the authority for protected requests.

```ts
const { client, snapshot } = useGhostlink(); // React; Vue uses snapshot.value in script.
// Render a loading state for idle/restoring, retry feedback for error,
// and authenticated/signed-out content only once ready.
async function retry() {
  try { await client.restoreSession(); }
  catch { /* Render snapshot.initializationError. */ }
}
```

Retry does not require remounting. Concurrent restoration calls share the current task. Failures do not replace a wallet-operation error or open an error modal. Restoration never emits `onAuthenticated` or requests a signature. On focus, the active client rechecks the session; ordinary timer checks do not continuously extend idle sessions.

The Vue showcase in `examples/vue/src/App.vue` demonstrates pending, failed, signed-out and authenticated states. Its `main.ts` uses the app plugin; the Nuxt demo supplies a component-local client to `GhostlinkProvider` and cleans up only its additional application subscription.

## SSR and hydration

Construction validates configuration and creates a deterministic idle snapshot with no wallet discovery, network calls, timers or listeners. React and Vue provider rendering and Vue plugin installation remain passive on the server. Create a separate client per SSR request; never share authenticated clients through a server module singleton.

The server and first browser render both start idle. Browser activation happens in the provider's mounted lifecycle, after hydration. Server-side protected routes use `auth.getSession(request)` with that request's cookies. Browser restoration must not be used as a substitute for server authorization.

## Headless ownership

```ts
const client = createGhostlink(config);
const release = client.attach();
const unsubscribe = client.subscribe(render);
try { await client.restoreSession(); }
catch { /* render reads initializationError and offers retry */ }

// When this owner stops using the client:
unsubscribe();
release(); // Idempotent. The client can be attached again.
// client.destroy(); // Only if permanently retiring it.
```

`attach()` is passive on the server. Explicit headless methods can still be called without an attachment, but browser focus/expiry monitoring requires an active attachment. Explicit operations can acquire wallet resources, so headless consumers should use this ownership pattern and release or destroy their clients when finished.
