<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, useId, watch } from 'vue';
import { ArrowLeft, X, ScanLine, Check, LoaderCircle, TriangleAlert, Link2, Copy, Camera, Clock, CircleX } from '@lucide/vue';
import { trapDialogFocus, createMessageQr, getPresentation, remainingTime, scanQrCamera, scanQrImage } from 'ghostlink-core';
import { useGhostlink } from './context';
defineProps<{ theme?: 'dark' | 'light'; variables?: Record<string, string> }>();
const { client, snapshot: s } = useGhostlink();
const view = computed(() => getPresentation(s.value, client.app));
const titleId = `ghostlink-${useId()}`;
const dialog = ref<HTMLDialogElement>(); const video = ref<HTMLVideoElement>();
const address = ref(''); const signature = ref('');
const qr = ref(''); const notice = ref(''); const camera = ref(false); const now = ref(Date.now());
let tick: ReturnType<typeof setInterval>; let detach: (() => void) | undefined; let stopCamera: (() => void) | undefined;
const expired = computed(() => !!s.value.challenge && Date.parse(s.value.challenge.expiresAt) <= now.value);
async function act(work: () => Promise<unknown>) { notice.value = ''; try { await work(); } catch { /* Core presents the typed error. */ } }
async function copyMessage() { try { await navigator.clipboard.writeText(s.value.challenge?.message ?? ''); notice.value = 'Message copied'; } catch { notice.value = 'Select and copy the message below.'; } }
function stop() { stopCamera?.(); stopCamera = undefined; camera.value = false; }
async function startCamera() {
  notice.value = ''; camera.value = true; await nextTick();
  try { const cancel = await scanQrCamera(video.value!, text => { signature.value = text.trim(); stop(); }); if (camera.value) stopCamera = cancel; else cancel(); }
  catch { camera.value = false; notice.value = 'Camera unavailable. Paste the signature or upload its QR image.'; }
}
async function upload(event: Event) { const file = (event.target as HTMLInputElement).files?.[0]; if (!file) return; try { signature.value = (await scanQrImage(file)).trim(); notice.value = 'Signature scanned'; } catch { notice.value = 'No readable QR code found. Paste the signature instead.'; } }
async function retry() { if (view.value.wallet?.kind === 'manual' && s.value.error?.code === 'INVALID_REQUEST' && s.value.walletId) { await act(() => client.connect(s.value.walletId!)); } else if (s.value.error?.code === 'NETWORK_MISMATCH' && !s.value.session && s.value.walletId) { const id = s.value.walletId; await act(async () => { await client.switchWalletNetwork(); await client.connect(id); }); } else if (s.value.session) client.open(); else if (s.value.account) await act(() => client.prepareAuthentication()); else if (s.value.walletId) await act(() => client.connect(s.value.walletId!)); else client.back(); }
watch(() => s.value.open, async open => { await nextTick(); if (open && !dialog.value?.open) dialog.value?.showModal(); else if (!open && dialog.value?.open) dialog.value.close(); if (!open) stop(); }, { flush: 'post' });
watch(() => s.value.challenge?.id, async () => { signature.value = ''; qr.value = ''; const message = s.value.challenge?.message; if (message) { const image = await createMessageQr(message); if (message === s.value.challenge?.message) qr.value = image; } });
watch(() => s.value.step, () => { notice.value = ''; stop(); });
onMounted(() => { detach = client.attachUI(); tick = setInterval(() => { now.value = Date.now(); }, 1000); if (s.value.open) dialog.value?.showModal(); });
onUnmounted(() => { clearInterval(tick); detach?.(); stop(); });
</script>
<template>
  <Teleport to="body">
    <dialog ref="dialog" class="gl-theme gl-dialog" :data-ghostlink-theme="theme ?? 'dark'" :style="variables" :aria-labelledby="titleId" @keydown="event => trapDialogFocus(event, dialog!)" @cancel.prevent="client.close" @click="event => { if (event.target === dialog) { const r = dialog!.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) client.close(); } }">
      <header class="gl-header">
        <button v-if="!['choose','connected'].includes(s.step)" type="button" class="gl-icon-button" aria-label="Back" :disabled="s.busy" @click="client.back"><ArrowLeft :size="15" /></button>
        <h2 :id="titleId" class="gl-title">{{ s.request?.title ?? view.title }}</h2>
        <span class="gl-status" :data-active="!!s.session"><span class="gl-dot" />{{ view.status }}</span>
        <button type="button" class="gl-icon-button" aria-label="Close" @click="client.close"><X :size="15" /></button>
      </header>
      <slot name="content" :snapshot="s" :client="client">
        <section v-if="s.step === 'choose'" class="gl-body">
          <div class="gl-wallets">
            <button v-for="w in s.wallets" :key="w.id" type="button" class="gl-wallet" :disabled="s.busy" @click="act(() => client.connect(w.id))">
              <span class="gl-wallet-mark" :data-wallet="w.id"><img v-if="w.icon" :src="w.icon" alt="" /><template v-else>{{ w.mark }}</template></span>
              <span class="gl-wallet-copy"><span class="gl-wallet-name">{{ w.name }}</span><span class="gl-wallet-note">{{ w.kind === 'manual' ? 'Mobile · manual message signing' : 'Browser wallet' }}</span></span>
              <span class="gl-badge" :data-installed="w.kind === 'injected' && w.available">{{ w.kind === 'manual' ? 'QR / paste' : w.available ? 'Installed' : 'Install' }}</span>
            </button>
            <p v-if="!s.wallets.length" class="gl-copy gl-center">No wallets configured.</p>
          </div>
          <button v-if="s.wallets.some(w => w.id === 'kaspium')" type="button" class="gl-button gl-mobile-button" :disabled="s.busy" @click="act(() => client.connect('kaspium'))"><ScanLine :size="16" />Sign with a mobile wallet</button>
          <div class="gl-footer"><span>Don't have a Kaspa wallet?</span><button type="button" class="gl-link" @click="client.showWalletHelp">Get started →</button></div>
        </section>
        <section v-else-if="s.step === 'connecting' || s.step === 'verifying'" class="gl-wait" aria-live="polite">
          <div class="gl-wait-mark"><span class="gl-wallet-mark" :data-wallet="view.wallet?.id"><img v-if="view.wallet?.icon" :src="view.wallet.icon" alt="" /><template v-else>{{ view.wallet?.mark ?? 'K' }}</template></span></div>
          <h3 class="gl-heading">{{ s.step === 'verifying' ? 'Verifying your signature' : `Waiting for ${view.wallet?.name ?? 'your wallet'}` }}</h3>
          <p class="gl-copy">{{ s.step === 'verifying' ? 'Confirming your account and establishing a secure application session.' : 'Review and approve the request in your wallet. Your private keys stay there.' }}</p>
          <div class="gl-progress"><LoaderCircle class="gl-spin" :size="14" />{{ s.step === 'verifying' ? 'Checking signature' : 'Awaiting wallet approval' }}</div>
          <button type="button" class="gl-button gl-full" @click="client.close">Cancel</button>
        </section>
        <section v-else-if="s.step === 'review'" class="gl-body">
          <div class="gl-app-card"><span class="gl-app-icon"><img v-if="client.app.icon" :src="client.app.icon" alt="" /><Link2 v-else :size="20" /></span><span><span class="gl-app-name">{{ client.app.name }}</span><span class="gl-domain">{{ view.domain }}</span></span></div>
          <h3 class="gl-label">Requested access · Kaspa</h3>
          <div class="gl-rows"><div class="gl-row"><span class="gl-row-label">chain</span><span class="gl-chip">kaspa:{{ s.network }}</span></div><div class="gl-row"><span class="gl-row-label">requests</span><span class="gl-chips"><span v-for="method in view.methods" :key="method" class="gl-chip">{{ method }}</span></span></div></div>
          <h3 class="gl-label">Signing account</h3><div class="gl-rows"><div class="gl-row"><Check :size="16" /><span class="gl-row-value">{{ s.account?.address }}</span></div></div>
          <div class="gl-notice"><TriangleAlert :size="15" /><span>This session can <strong>request signatures</strong>, but every transaction still needs a separate in-wallet approval.</span></div>
          <div class="gl-actions"><button type="button" class="gl-button" @click="act(() => client.disconnect())">Reject</button><button type="button" class="gl-button gl-primary" :disabled="s.busy" @click="act(() => client.prepareAuthentication())">Continue to sign in</button></div>
        </section>
        <section v-else-if="s.step === 'address'" class="gl-body">
          <p class="gl-copy">Copy your receiving address from Kaspium and paste it below. Choose that same address in Kaspium’s Sign message tool.</p>
          <form @submit.prevent="act(() => client.prepareAuthentication(address))"><label class="gl-field"><span>Signing address · {{ s.network }}</span><input v-model="address" class="gl-input" aria-label="Signing address" :placeholder="s.network === 'mainnet' ? 'kaspa:…' : 'kaspatest:…'" required maxlength="100" autocomplete="off" spellcheck="false" /></label><button class="gl-button gl-primary gl-full" :disabled="s.busy">Create login message</button></form>
          <div class="gl-notice"><TriangleAlert :size="15" /><span>Signing proves control of this address. It does not create a live connection to Kaspium.</span></div>
        </section>
        <section v-else-if="s.step === 'manual'" class="gl-body">
          <p class="gl-copy gl-center">In Kaspium, open <strong>Settings → Advanced → Sign message</strong>. Select this address, then use the QR button inside the message field. Return the signature here.</p>
          <div class="gl-rows"><div class="gl-row"><span class="gl-row-label">Account</span><span class="gl-row-value">{{ s.account?.address }}</span></div></div>
          <div v-if="qr" class="gl-qr-frame"><img :src="qr" alt="QR code containing the exact login message" /></div>
          <div class="gl-timer"><Clock :size="13" />{{ expired ? 'Message expired' : `Login expires in ${remainingTime(s.challenge?.expiresAt, now)}` }}</div>
          <button type="button" class="gl-button gl-full" @click="copyMessage"><Copy :size="14" />Copy login message</button>
          <details class="gl-message" style="margin-top:12px"><summary class="gl-label">Review exact message</summary><pre>{{ s.challenge?.message }}</pre></details>
          <form @submit.prevent="act(() => client.authenticate({ signature: signature.trim() }))"><label class="gl-field"><span>Signature from Kaspium</span><textarea v-model="signature" class="gl-input" aria-label="Signature from Kaspium" rows="3" maxlength="132" placeholder="Paste the complete signature" required autocomplete="off" spellcheck="false" /></label>
            <div class="gl-actions"><button type="button" class="gl-button" @click="camera ? stop() : startCamera()"><Camera :size="14" />{{ camera ? 'Stop camera' : 'Scan signature' }}</button><label class="gl-button">Upload QR<input type="file" accept="image/*" aria-label="Upload signature QR" class="gl-sr-only" @change="upload" /></label></div>
            <video v-if="camera" ref="video" class="gl-video" autoplay muted playsinline aria-label="Signature QR scanner" />
            <button v-if="expired" type="button" class="gl-button gl-primary gl-full" style="margin-top:14px" :disabled="s.busy" @click="act(() => client.prepareAuthentication())">Generate a new message</button>
            <button v-else class="gl-button gl-primary gl-full" style="margin-top:14px" :disabled="s.busy || !signature.trim()">Verify and sign in</button>
          </form>
          <p v-if="notice" role="status" class="gl-copy" style="margin-top:12px">{{ notice }}</p>
        </section>
        <section v-else-if="s.step === 'sign'" class="gl-body">
          <div class="gl-app-card"><span class="gl-app-icon"><Link2 :size="18" /></span><span><span class="gl-app-name">{{ s.request?.title ?? 'Signature request' }}</span><span class="gl-domain">{{ view.domain }}</span></span></div>
          <div class="gl-message"><h3 class="gl-label">{{ s.request ? 'Request' : 'Message' }}</h3><pre>{{ s.request?.message ?? s.challenge?.message }}</pre></div>
          <div class="gl-row"><span class="gl-row-label">Account</span><span class="gl-row-value">{{ view.address }}</span></div>
          <p class="gl-copy" style="margin-top:12px">Continue to your wallet to review and approve.</p>
          <div class="gl-actions"><button type="button" class="gl-button" @click="client.close">Cancel</button><button type="button" class="gl-button gl-primary" :disabled="s.busy && !s.request" @click="s.request ? client.confirmRequest() : act(() => client.authenticate())">{{ s.request ? 'Continue in wallet' : 'Sign message' }}</button></div>
        </section>
        <section v-else-if="s.step === 'connected' && s.session" class="gl-connected">
          <div class="gl-center" style="margin-bottom:16px"><span class="gl-success-icon"><Check :size="30" /></span><h3 class="gl-heading">Session active</h3><p class="gl-copy" style="margin:4px 0 0">{{ view.wallet?.name ?? 'Kaspa account' }} · {{ view.networkLabel }}</p></div>
          <div class="gl-rows"><div v-for="row in view.sessionRows" :key="row.label" class="gl-row"><span class="gl-row-label">{{ row.label }}</span><span class="gl-row-value" :title="row.full">{{ row.value }}</span></div></div>
          <p v-if="s.connection !== 'connected'" class="gl-copy">Your application session is authenticated. Automated wallet requests require a live provider connection.</p>
          <button type="button" class="gl-button gl-danger gl-full" @click="act(() => client.disconnect())">Sign out</button>
        </section>
        <section v-else-if="s.step === 'error'" class="gl-body gl-center" style="padding:30px 22px 20px">
          <span class="gl-error-icon"><CircleX :size="28" /></span><h3 class="gl-heading">{{ s.error?.code === 'USER_REJECTED' ? 'Request rejected' : s.error?.code === 'EXPIRED' ? 'Login request expired' : 'Unable to complete request' }}</h3><p class="gl-copy" role="alert">{{ s.error?.message }}</p><span class="gl-code">{{ s.error?.code }}</span>
          <a v-if="s.error?.code === 'UNAVAILABLE' && view.wallet" class="gl-button gl-full" :href="view.wallet.installUrl" target="_blank" rel="noopener noreferrer" style="margin-top:12px">Get {{ view.wallet.name }}</a>
          <div class="gl-actions"><button type="button" class="gl-button" @click="client.back">All wallets</button><button type="button" class="gl-button gl-primary" :disabled="s.busy" @click="retry">{{ s.session ? 'Back to session' : view.wallet?.kind === 'manual' && s.error?.code === 'INVALID_REQUEST' ? 'Edit address' : s.error?.code === 'NETWORK_MISMATCH' ? `Switch to ${s.network}` : 'Try again' }}</button></div>
        </section>
        <section v-else-if="s.step === 'getwallet'" class="gl-body">
          <p class="gl-copy">A wallet holds your KAS and signs for you. Install a wallet, then return to sign in. Login itself requires no funds.</p>
          <div class="gl-onboarding"><span class="gl-number">1</span><div><strong>Choose a Kaspa wallet</strong><p><a v-for="w in s.wallets" :key="w.id" :href="w.installUrl" target="_blank" rel="noopener noreferrer" style="margin-right:12px">{{ w.name }}</a></p></div></div>
          <div class="gl-onboarding"><span class="gl-number">2</span><div><strong>Back up your recovery phrase</strong><p>Keep it offline. Ghostlink will never ask for your recovery phrase or private key.</p></div></div>
          <div class="gl-onboarding"><span class="gl-number">3</span><div><strong>Return and connect</strong><p>Approve the login message in your wallet to prove ownership of your account.</p></div></div>
          <button type="button" class="gl-button gl-primary gl-full" style="margin-top:7px" @click="client.back">I have a wallet now</button>
        </section>
      </slot>
      <p v-if="s.revocationPending" role="status" class="gl-error" style="padding:0 18px 12px">Session revocation pending. Reconnecting to the authentication server…</p>
    </dialog>
  </Teleport>
</template>
