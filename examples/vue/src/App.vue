<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue';
import { Sun, Moon, ArrowUpRight, ShieldCheck, Palette } from '@lucide/vue';
import { GhostlinkConnectButton, GhostlinkModal, useGhostlink } from 'ghostlink-vue';
import { formatKas, parseKasAmount } from 'ghostlink-core';
import type { Network, TransactionFormat } from 'ghostlink-core';
const { client, snapshot: s } = useGhostlink();
const theme = ref<'dark' | 'light'>('dark'); const branded = ref(false);
watchEffect(() => {
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.value === 'dark' ? '#0C0D11' : '#F3F3F5');
});
const variables = computed((): Record<string, string> => branded.value ? {
  '--ghostlink-button': '#b9e5d7',
  '--ghostlink-button-text': '#132921',
  '--ghostlink-accent': theme.value === 'dark' ? '#7fc8a9' : '#2f7d5b',
  '--ghostlink-accent-soft': theme.value === 'dark' ? 'rgba(127,200,169,.12)' : 'rgba(47,125,91,.10)',
  '--ghostlink-accent-line': theme.value === 'dark' ? 'rgba(127,200,169,.38)' : 'rgba(47,125,91,.32)',
  '--ghostlink-font-heading': 'Figtree, sans-serif',
  '--ghostlink-connect-background': '#b9e5d7',
  '--ghostlink-connect-text': '#132921',
  '--ghostlink-account-background': '#b9e5d7',
  '--ghostlink-account-text': '#132921',
  '--ghostlink-account-border': '#2f7d5b',
} : {});
const wallet = computed(() => s.value.wallets.find(w => w.id === s.value.walletId));
const checkingSession = computed(() => s.value.initialization === 'idle' || s.value.initialization === 'restoring');
const canRequest = computed(() => s.value.initialization === 'ready' && !!s.value.session && s.value.connection === 'connected');
const destination = ref(''); const amount = ref(''); const fee = ref('0'); const message = ref('Hello from Ghostlink. This message does not authorize a transaction.');
const payload = ref(''); const format = ref<TransactionFormat>('kaspa-transaction-json');
const result = ref(''); const error = ref('');
async function perform(work: () => Promise<unknown>) { result.value = ''; error.value = ''; try { const value = await work(); result.value = typeof value === 'string' ? value : JSON.stringify(value, null, 2); } catch (e) { error.value = e instanceof Error ? e.message : 'Request failed.'; } }
async function privateRequest() { const r = await fetch('/api/private', { credentials: 'same-origin' }); const body = await r.json(); if (!r.ok) throw new Error(body.error); return body; }
function testSign() { return client.signMessage(`Test signature for ${new URL(client.app.url).host}. This message does not authorize a transaction.`); }
async function retrySession() { try { await client.restoreSession(); } catch { /* initializationError provides retry feedback. */ } }
</script>
<template>
  <div class="example gl-theme" :data-ghostlink-theme="theme" :style="variables">
    <header class="example-header"><a class="example-logo" href="/"><span class="gl-app-icon"><svg width="28" height="18" viewBox="0 0 34 20" fill="none" aria-hidden="true" focusable="false"><circle cx="11" cy="10" r="6.4" fill="currentColor" /><circle cx="23" cy="10" r="6.4" stroke="currentColor" stroke-width="2.1" /></svg></span><span>Ghostlink</span></a><div class="example-nav"><span class="example-caption">Kaspa wallet authentication</span><button class="gl-icon-button" :aria-label="theme === 'dark' ? 'Use light theme' : 'Use dark theme'" @click="theme = theme === 'dark' ? 'light' : 'dark'"><Sun v-if="theme === 'dark'" :size="17" /><Moon v-else :size="17" /></button><GhostlinkConnectButton :theme="theme" :variables="variables" /></div></header>
    <main class="example-main">
      <section class="example-intro"><span class="gl-label">GHOSTLINK / VUE EXAMPLE</span><h1>One connection.<br />Your Kaspa account.</h1><p>Connect a wallet, approve a login message, and try authenticated requests. Your keys stay in your wallet.</p><div class="example-controls"><label>Network<select :value="s.network" class="gl-input" aria-label="Network" :disabled="s.busy || checkingSession" @change="client.setNetwork(($event.target as HTMLSelectElement).value as Network)"><option value="testnet-11">Testnet 11</option><option value="testnet-10">Testnet 10</option><option value="mainnet">Mainnet</option></select></label><button class="gl-button" :aria-pressed="branded" @click="branded = !branded"><Palette :size="15" />{{ branded ? 'Default branding' : 'Try custom branding' }}</button></div></section>
      <section class="example-panel" aria-label="Authentication state"><div class="example-panel-heading"><h2>Your session</h2><span class="gl-status" :data-active="s.initialization === 'ready' && !!s.session"><span class="gl-dot" />{{ checkingSession ? 'checking session' : s.initialization === 'error' ? 'session unavailable' : s.session ? 'authenticated' : 'signed out' }}</span></div>
        <p v-if="checkingSession" class="gl-copy" role="status">Checking your session…</p>
        <div v-else-if="s.initialization === 'error'">
          <p class="gl-error" role="alert">{{ s.initializationError?.message }}</p>
          <button type="button" class="gl-button" @click="retrySession">Retry session check</button>
        </div>
        <template v-else-if="s.session"><div class="example-account"><span class="gl-success-icon"><ShieldCheck :size="28" /></span><h3>Ownership verified</h3><p>{{ s.session.address }}</p></div><div class="gl-rows"><div class="gl-row"><span class="gl-row-label">Network</span><span class="gl-row-value">{{ s.session.chainId }}</span></div><div class="gl-row"><span class="gl-row-label">Expires</span><span class="gl-row-value">{{ new Date(s.session.expiresAt).toLocaleString() }}</span></div><div class="gl-row"><span class="gl-row-label">Connection</span><span class="gl-row-value">{{ s.connection === 'connected' ? wallet?.name : 'Authentication only' }}</span></div><div v-if="s.balance !== null" class="gl-row"><span class="gl-row-label">Balance</span><span class="gl-row-value">{{ formatKas(s.balance) }} KAS</span></div></div><div class="gl-actions"><button class="gl-button gl-primary" @click="perform(privateRequest)">Test protected API<ArrowUpRight :size="14" /></button><button class="gl-button" @click="client.disconnect">Sign out</button></div></template>
        <div v-else class="example-empty"><span class="gl-app-icon"><svg width="40" height="24" viewBox="0 0 34 20" fill="none" aria-hidden="true" focusable="false"><circle cx="11" cy="10" r="6.4" fill="currentColor" /><circle cx="23" cy="10" r="6.4" stroke="currentColor" stroke-width="2.1" /></svg></span><h3>Ready when you are</h3><p>Choose a wallet and approve the login message. Connecting alone does not sign you in.</p><GhostlinkConnectButton :theme="theme" :variables="variables" /></div>
        <p v-if="s.revocationPending" class="gl-error" role="status">Server revocation is pending. Reconnecting…</p>
      </section>
      <section v-if="s.initialization === 'ready' && s.session" class="example-panel" aria-label="Wallet requests"><div class="example-panel-heading"><h2>Try a wallet request</h2><span class="gl-badge">{{ s.network }}</span></div><p class="gl-copy">Signing and transfers need a separate approval in your wallet.</p><p v-if="!canRequest" class="gl-copy">Connect your browser wallet to use wallet requests.</p>
        <div class="gl-actions" style="margin-bottom:18px"><button type="button" class="gl-button" :disabled="!canRequest || s.busy" @click="perform(() => client.refreshBalance())">Refresh balance</button><button type="button" class="gl-button" :disabled="!canRequest || !wallet?.capabilities.messageSigning || s.busy" @click="perform(testSign)">Test sign</button></div>
        <form @submit.prevent="perform(() => client.signMessage(message))"><label class="gl-field"><span>Message</span><textarea v-model="message" class="gl-input" rows="3" aria-label="Test message" /></label><button class="gl-button" :disabled="!canRequest || s.busy">Request message signature</button></form>
        <hr class="example-divider" />
        <form @submit.prevent="perform(() => client.sendTransaction({ toAddress: destination.trim(), amountSompi: parseKasAmount(amount), priorityFeeSompi: parseKasAmount(fee) }))"><h3 class="gl-heading">Transfer KAS</h3><p class="gl-copy">{{ s.network === 'mainnet' ? 'Mainnet sends real KAS. Review the recipient and amount in your wallet.' : 'Use testnet funds to exercise an actual transfer.' }}</p><label class="gl-field"><span>Recipient</span><input v-model="destination" class="gl-input" aria-label="Recipient" :placeholder="s.network === 'mainnet' ? 'kaspa:…' : 'kaspatest:…'" required /></label><div class="example-fields"><label class="gl-field"><span>Amount in KAS</span><input v-model="amount" class="gl-input" aria-label="Amount in KAS" inputmode="decimal" placeholder="0.00" required /></label><label class="gl-field"><span>Priority fee in KAS</span><input v-model="fee" class="gl-input" aria-label="Priority fee in KAS" inputmode="decimal" required /></label></div><p class="gl-copy"><small>Your wallet calculates and displays the final network fee.</small></p><button class="gl-button gl-primary" :disabled="!canRequest || !wallet?.capabilities.transfer || s.busy">Review transfer in wallet<ArrowUpRight :size="14" /></button></form>
        <hr class="example-divider" />
        <details><summary class="gl-label">Advanced: sign without broadcasting</summary><p class="gl-copy">Use a transaction constructed with the official Kaspa SDK. Ghostlink passes the declared format to your wallet without broadcasting.</p><form @submit.prevent="perform(() => client.signTransaction({ format, payload, network: s.network, address: s.session!.address }))"><label class="gl-field"><span>Format</span><select v-model="format" class="gl-input" aria-label="Transaction format"><option value="kaspa-transaction-json">Kaspa transaction JSON</option><option value="pskt-json">PSKT JSON</option></select></label><label class="gl-field"><span>Serialized transaction</span><textarea v-model="payload" class="gl-input" rows="5" aria-label="Serialized transaction" required /></label><button class="gl-button" :disabled="!canRequest || !wallet?.capabilities.transactionFormats.includes(format) || s.busy">Request transaction signature</button></form></details>
      </section>
      <section v-if="s.session && (result || error)" class="example-panel example-result" aria-live="polite"><h2>{{ error ? 'Request failed' : 'Request result' }}</h2><p v-if="error" class="gl-error">{{ error }}</p><pre v-else>{{ result }}</pre></section>
    </main>
    <footer class="example-footer"><span>Ghostlink · your keys, your approval</span><span>Built with the public Vue and server APIs</span></footer>
    <GhostlinkModal :theme="theme" :variables="variables" />
  </div>
</template>
