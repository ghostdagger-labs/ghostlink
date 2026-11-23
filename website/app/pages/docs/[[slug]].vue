<script setup lang="ts">
import { Search, Sun, Moon, Menu, X } from '@lucide/vue';
import { releaseVersion, repositoryUrl } from '../../data/release';
import type { DocsCatalog, DocsPage } from '../../types/docs';

definePageMeta({ key: route => route.path });
const route = useRoute();
const slug = String(route.params.slug || 'index');
const { data: catalog } = await useAsyncData('docs-catalog', () => $fetch<DocsCatalog>('/__docs/catalog.json'));
if (!catalog.value?.pages.some(page => page.slug === slug)) throw createError({ statusCode: 404, statusMessage: 'Documentation page not found' });
const { data: article } = await useAsyncData(`docs-${slug}`, () => $fetch<DocsPage>(`/__docs/${slug}.json`));
if (!article.value) throw createError({ statusCode: 404, statusMessage: 'Documentation page not found' });
const page = computed(() => article.value!);
const { theme, toggleTheme, ready } = useLandingTheme();
const mode = ref<'rendered' | 'markdown'>('rendered');
const query = useState('docs-search', () => '');
const { data: searchIndex, status: searchStatus, error: searchError, execute: loadSearch } = await useAsyncData('docs-search-index', () => $fetch<Record<string, string>>('/__docs/search.json'), { server: false, immediate: false });
function ensureSearch() { if (!searchIndex.value && searchStatus.value !== 'pending') void loadSearch(); }
const activeHeading = ref('');
const notice = ref('');
const headerSearch = ref<HTMLInputElement>();
const drawerSearch = ref<HTMLInputElement>();
const drawer = ref<HTMLDialogElement>();
const content = ref<HTMLElement>();
const main = ref<HTMLElement>();
const mobileContents = ref<HTMLDetailsElement>();
const navigationOpen = ref(false);
const filtered = computed(() => {
  const terms = query.value.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!terms.length || !searchIndex.value) return catalog.value!.pages;
  return catalog.value!.pages.filter(page => terms.every(term => (searchIndex.value![page.slug] ?? '').includes(term)));
});
const updatedLabel = computed(() => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${page.value.updated}T00:00:00Z`)));
const sourceUrl = computed(() => `${repositoryUrl}/edit/main/${page.value.source.split('/').map(encodeURIComponent).join('/')}`);
const groupSlug = computed(() => page.value.group.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
useSeoMeta({ title: () => `${page.value.title} — Ghostlink Docs`, description: () => page.value.description });
useHead({ link: [{ rel: 'canonical', href: `https://www.ghostlinksdk.com${page.value.path}` }] });

let returnFocus: HTMLElement | null = null;
let previousOverflow = '';
let observer: IntersectionObserver | undefined;
let copyTimer: ReturnType<typeof setTimeout> | undefined;
let copiedButton: HTMLButtonElement | undefined;
async function openNavigation(search = false) {
  ensureSearch();
  if (!drawer.value || drawer.value.open) return;
  returnFocus = document.activeElement as HTMLElement;
  previousOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  drawer.value.showModal(); navigationOpen.value = true;
  if (search) { await nextTick(); drawerSearch.value?.focus(); }
}
function closeNavigation() { drawer.value?.close(); }
function afterClose() {
  navigationOpen.value = false; document.body.style.overflow = previousOverflow;
  returnFocus?.focus();
}
function searchInput() { ensureSearch(); if (window.innerWidth < 768) void openNavigation(true); }
function keyboard(event: KeyboardEvent) {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    ensureSearch();
    if (window.innerWidth < 768) void openNavigation(true);
    else { headerSearch.value?.focus(); headerSearch.value?.select(); }
  }
}
function drawerKeyboard(event: KeyboardEvent) {
  if (event.key !== 'Tab') return;
  const elements = [...drawer.value!.querySelectorAll<HTMLElement>('button, a[href], input')].filter(el => el.getClientRects().length > 0);
  const first = elements[0], last = elements.at(-1);
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
}
function observeHeadings() {
  observer?.disconnect();
  if (mode.value !== 'rendered') return;
  observer = new IntersectionObserver(entries => {
    const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
    if (visible[0]) activeHeading.value = visible[0].target.id;
  }, { rootMargin: '-90px 0px -65% 0px' });
  content.value?.querySelectorAll('h2[id], h3[id]').forEach(heading => observer!.observe(heading));
}
async function selectHeading(id: string, updateHistory = true) {
  mode.value = 'rendered';
  await nextTick();
  const target = document.getElementById(id);
  if (!target || !main.value?.contains(target)) return;
  if (updateHistory && location.hash !== `#${id}`) history.pushState(null, '', `#${encodeURIComponent(id)}`);
  activeHeading.value = id;
  if (mobileContents.value) mobileContents.value.open = false;
  target.scrollIntoView({ behavior: 'instant', block: 'start' });
  target.tabIndex = -1; target.focus({ preventScroll: true });
}
function restoreHash() {
  if (location.hash) { try { void selectHeading(decodeURIComponent(location.hash.slice(1)), false); } catch { /* Malformed fragments do not prevent reading. */ } }
}
async function articleClick(event: MouseEvent) {
  const element = event.target as HTMLElement;
  const button = element.closest<HTMLButtonElement>('button[data-copy-code]');
  if (button) {
    const code = document.getElementById(button.dataset.copyCode!);
    if (!code) return;
    clearTimeout(copyTimer); notice.value = '';
    if (copiedButton) copiedButton.textContent = 'copy';
    copiedButton = button;
    try {
      await navigator.clipboard.writeText(code.textContent ?? '');
      button.textContent = 'copied'; notice.value = 'Code copied to clipboard.';
    } catch {
      button.textContent = 'retry'; notice.value = 'Could not copy. Select the code and copy it manually, or try again.';
    }
    copyTimer = setTimeout(() => { button.textContent = 'copy'; }, 1800);
    return;
  }
  const link = element.closest<HTMLAnchorElement>('a[href^="#"]');
  if (link) { event.preventDefault(); void selectHeading(decodeURIComponent(link.hash.slice(1))); }
}
watch(mode, async () => { await nextTick(); observeHeadings(); });
watch(query, value => { if (value.trim()) ensureSearch(); });
onMounted(async () => {
  if (query.value.trim()) ensureSearch();
  window.addEventListener('keydown', keyboard);
  window.addEventListener('hashchange', restoreHash);
  window.addEventListener('popstate', restoreHash);
  observeHeadings();
  await nextTick(); restoreHash();
});
onBeforeUnmount(() => {
  observer?.disconnect(); clearTimeout(copyTimer);
  window.removeEventListener('keydown', keyboard);
  window.removeEventListener('hashchange', restoreHash);
  window.removeEventListener('popstate', restoreHash);
  if (drawer.value?.open) { drawer.value.close(); document.body.style.overflow = previousOverflow; }
});
</script>

<template>
  <div class="docs-reader" :data-theme="theme" :data-enhanced="ready">
    <a href="#docs-main" class="docs-skip">Skip to content</a>
    <header class="docs-header">
      <div class="docs-header-inner">
        <NuxtLink to="/" class="docs-brand" aria-label="Ghostlink home">
          <svg width="28" height="17" viewBox="0 0 34 20" fill="none" aria-hidden="true"><circle cx="11" cy="10" r="6.4" fill="currentColor" /><circle cx="23" cy="10" r="6.4" stroke="currentColor" stroke-width="2.1" /></svg>
          <span>Ghostlink</span>
        </NuxtLink>
        <span class="docs-badge">docs</span>
        <div class="docs-search" role="search">
          <Search :size="14" aria-hidden="true" />
          <label class="docs-sr-only" for="docs-search">Search the docs</label>
          <input id="docs-search" ref="headerSearch" v-model="query" type="search" placeholder="Search the docs" autocomplete="off" :disabled="!ready" @focus="ensureSearch" @input="searchInput" @keydown.esc="query = ''" />
          <kbd aria-hidden="true">⌘K</kbd>
        </div>
        <div class="docs-header-actions">
          <div class="docs-view-switch" role="group" aria-label="Document view">
            <button type="button" :aria-pressed="mode === 'rendered'" :disabled="!ready" @click="mode = 'rendered'">Rendered</button>
            <button type="button" :aria-pressed="mode === 'markdown'" :disabled="!ready" @click="mode = 'markdown'">Markdown</button>
          </div>
          <span class="docs-version">v{{ releaseVersion }}</span>
          <button type="button" class="docs-theme" :aria-label="theme === 'dark' ? 'Use light theme' : 'Use dark theme'" :disabled="!ready" @click="toggleTheme"><Sun v-if="theme === 'dark'" :size="15" /><Moon v-else :size="15" /></button>
        </div>
      </div>
    </header>

    <nav class="docs-mobile-bar" v-if="ready" aria-label="Mobile documentation">
      <button type="button" aria-controls="docs-drawer" :aria-expanded="navigationOpen" @click="openNavigation()"><Menu :size="16" /> Browse docs</button>
      <span>{{ page.label }}</span>
    </nav>
    <div class="docs-layout">
      <aside class="docs-sidebar" aria-label="Documentation navigation">
        <p v-if="searchError" class="docs-search-count" role="status">Search unavailable. <button type="button" @click="loadSearch()">Retry</button></p>
        <p v-else-if="query.trim() && !searchIndex" class="docs-search-count" role="status">Loading search…</p>
        <p v-else-if="query.trim()" class="docs-search-count" role="status">{{ filtered.length }} {{ filtered.length === 1 ? 'page' : 'pages' }} found <button type="button" @click="query = ''">Clear</button></p>
        <DocsNavigation :pages="filtered" :active="slug" :query="query" />
      </aside>
      <details v-if="!ready" class="docs-mobile-fallback"><summary>Browse documentation</summary><DocsNavigation :pages="catalog!.pages" :active="slug" query="" /></details>
      <main id="docs-main" ref="main" class="docs-main" tabindex="-1">
        <div class="docs-meta">
          <div class="docs-breadcrumb"><NuxtLink to="/docs">docs</NuxtLink><span>/</span><span>{{ groupSlug }}</span><span>/</span><a :href="`/docs/${slug}.md`">{{ slug === 'index' ? 'introduction' : slug }}.md</a></div>
          <div class="docs-reading"><span>{{ page.readingMinutes }} min read</span><span class="docs-meta-divider" /><span>Updated <time :datetime="page.updated">{{ updatedLabel }}</time></span></div>
        </div>
        <header class="docs-article-header"><h1 :id="page.titleId">{{ page.title }}</h1><p>{{ page.description }}</p></header>
        <details ref="mobileContents" class="docs-inline-contents"><summary>On this page</summary><DocsContents :headings="page.toc" :active="activeHeading" @select="selectHeading" /></details>
        <article v-if="mode === 'rendered'" ref="content" class="docs-prose" :aria-label="page.title" @click="articleClick" v-html="page.html" />
        <div v-else class="docs-raw">
          <div class="docs-code-bar"><span>{{ slug === 'index' ? 'introduction' : slug }}.md</span><span>{{ (page.bytes / 1024).toFixed(1) }} kB</span></div>
          <pre tabindex="0" aria-label="Markdown source"><code>{{ page.raw }}</code></pre>
        </div>
        <p class="docs-sr-only" role="status" aria-live="polite">{{ notice }}</p>
        <nav class="docs-pagination" aria-label="Previous and next pages">
          <NuxtLink v-if="page.previous" :to="page.previous.path" :prefetch="false"><span>Previous</span><strong>{{ page.previous.label }}</strong></NuxtLink>
          <NuxtLink v-if="page.next" :to="page.next.path" :prefetch="false" class="docs-next"><span>Next</span><strong>{{ page.next.label }}</strong></NuxtLink>
        </nav>
        <div class="docs-mobile-links"><a :href="sourceUrl">Edit this page</a><a :href="`/docs/${slug}.md`">Markdown source</a><NuxtLink to="/demo">Open the demo</NuxtLink></div>
      </main>
      <aside class="docs-right" aria-label="Article resources">
        <div class="docs-toc"><h2>On this page</h2><DocsContents :headings="page.toc" :active="activeHeading" @select="selectHeading" /></div>
        <div class="docs-card"><h2>Contributing</h2><p>These pages are Markdown in the repo. Fix a typo, open a PR.</p><a :href="sourceUrl">Edit this page</a></div>
        <div class="docs-card docs-demo-card"><h2>Try the flow</h2><p>Connect a supported wallet and try a verified application login.</p><NuxtLink to="/demo">Open the demo</NuxtLink></div>
      </aside>
    </div>

    <dialog id="docs-drawer" ref="drawer" class="docs-drawer" aria-labelledby="docs-drawer-title" @close="afterClose" @keydown="drawerKeyboard" @click="event => { if (event.target === drawer) closeNavigation(); }">
      <div class="docs-drawer-header"><h2 id="docs-drawer-title">Documentation</h2><button type="button" aria-label="Close documentation navigation" @click="closeNavigation"><X :size="20" /></button></div>
      <label class="docs-drawer-search"><span>Search the docs</span><input ref="drawerSearch" v-model="query" type="search" placeholder="Search the docs" @keydown.esc.stop.prevent="query ? query = '' : closeNavigation()" /></label>
      <p v-if="searchError" class="docs-search-count" role="status">Search unavailable. <button type="button" @click="loadSearch()">Retry</button></p>
      <p v-else-if="query.trim() && !searchIndex" class="docs-search-count" role="status">Loading search…</p>
      <p v-else-if="query.trim()" class="docs-search-count" role="status">{{ filtered.length }} {{ filtered.length === 1 ? 'page' : 'pages' }} found <button type="button" @click="query = ''">Clear</button></p>
      <DocsNavigation :pages="filtered" :active="slug" :query="query" @navigate="closeNavigation" />
    </dialog>
  </div>
</template>
