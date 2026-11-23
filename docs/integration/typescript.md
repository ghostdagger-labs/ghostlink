---
description: "Build a framework-neutral login flow with explicit ownership, session readiness, and server-verified protected requests."
updated: '2026-11-23'
---
# Headless TypeScript

## Prepare the app and backend

Follow [Installation](../getting-started/installation.md) and [Node server setup](../backend/node.md). Serve or proxy your browser app, `/auth/ghostlink/*`, and your protected API under the same origin. Match the client network to the server's allowed networks.

This complete browser module creates a small login UI without framework components. Add a `<div id="wallet-login"></div>` to your HTML and load the module through your TypeScript bundler. Adjust the app name and network for your deployment.

<!-- docs-check: headless.ts -->
```ts
import { createGhostlink, GhostlinkError } from '@ghostdagger/ghostlink-core';
import '@ghostdagger/ghostlink-core/styles.css';

const root = document.querySelector<HTMLDivElement>('#wallet-login');
if (!root) throw new Error('Add #wallet-login to the page.');
root.innerHTML = '<p role="status"></p><button type="button">Sign in with KasWare</button><button type="button">Sign out</button><button type="button">Retry session</button><button type="button">Load profile</button>';
const status = root.querySelector('p')!;
const [login, logout, retry, profile] = Array.from(root.querySelectorAll('button'));

const client = createGhostlink({
  app: { name: 'My Kaspa app', url: window.location.origin },
  network: 'testnet-11',
});
const release = client.attach();
let notice = '';
let identity = '';
let identityRevision = 0;
let disposed = false;
function render() {
  if (disposed) return;
  const s = client.getSnapshot();
  const ready = s.initialization === 'ready';
  const nextIdentity = ready && s.session ? JSON.stringify([s.session.accountId, s.session.issuedAt]) : '';
  if (identity !== nextIdentity) {
    identity = nextIdentity;
    identityRevision++;
    notice = ''; // Remove protected results as soon as identity becomes unresolved.
  }
  login.disabled = !ready || s.busy || !!s.session || s.revocationPending;
  logout.disabled = !ready || !s.session || s.busy;
  retry.hidden = s.initialization !== 'error';
  profile.disabled = !ready || !s.session;
  status.textContent = s.revocationPending ? 'Signed out here; server revocation is pending.'
    : s.initialization === 'error' ? 'Could not check your session. Retry when connected.'
    : !ready ? 'Checking your session…'
    : notice || (s.session ? 'Signed in: ' + s.session.address : 'Signed out');
}
const unsubscribe = client.subscribe(render);
async function act(work: () => Promise<unknown>) {
  notice = '';
  try { await work(); }
  catch (error) {
    notice = error instanceof GhostlinkError ? error.message : 'Request failed. Try again.';
  }
  render();
}
login.onclick = () => void act(async () => {
  await client.connect('kasware');
  await client.prepareAuthentication();
  // Present the exact challenge before asking the wallet to sign.
  const message = client.getSnapshot().challenge?.message;
  if (!message || !window.confirm(message)) { client.close(); return; }
  await client.authenticate();
});
logout.onclick = () => void act(() => client.disconnect());
retry.onclick = () => void act(() => client.restoreSession());
profile.onclick = () => void act(async () => {
  const revision = identityRevision;
  if (!identity) return;
  const current = () => !disposed && revision === identityRevision && !!identity;
  const response = await fetch('/api/private', { credentials: 'same-origin', cache: 'no-store' });
  if (!current()) return;
  if (response.status === 401) { await client.restoreSession(); return; }
  if (!response.ok) throw new Error('Protected request failed');
  const profile: { address: string } = await response.json();
  if (current()) notice = 'Server verified: ' + profile.address;
});
render();

// Call when this view is removed. Ordinary cleanup preserves the server session.
export function dispose() {
  disposed = true;
  identityRevision++;
  unsubscribe();
  release();
  root?.replaceChildren();
}
```

The native confirmation is intentionally a minimal review step for this example. A production custom interface should present application, account, network, exact message, progress, rejection, and retry states in an accessible flow. The supplied Vue/React modal already implements that interface.

Protected results are cleared when identity becomes unresolved or changes. A response that arrives after logout or teardown is discarded. Keep this guard when adapting the example to your own views.

## Ownership and restoration

`attach()` activates discovery, restoration, and lifecycle listeners in the browser. Store the release function and call it on teardown. The snapshot starts idle; restoration does not ask for a signature. Retry failed identity checks with `restoreSession()`.

Use `destroy()` only to permanently retire a client. Releasing a view does not sign the user out; `disconnect()` does.

## Styles and wallet requests

The stylesheet affects supplied `.gl-theme` elements only; style your own headless controls yourself. Optional `fonts.css` supplies the bundled fonts.

This example only authenticates and makes a protected read. For additional wallet requests, implement a deliberate review and confirmation flow and check [signing capabilities](../concepts/transactions.md). Never use a balance or provider address as proof of server authentication.

## Verify the flow

Run the backend and browser app. Connect KasWare on Testnet 11, inspect and approve the login message, load the protected profile, reload, then sign out. The profile must return 401 after logout. Also test rejection and an unavailable backend. See [Errors](../reference/errors.md) and [Provider lifecycle](lifecycle.md).
