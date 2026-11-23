/** Explicit publication allowlist. Array order also defines previous/next navigation. */
export interface DocsEntry { slug: string; label: string; group: string; source: string }
export const docsManifest = [
  { slug: 'index', label: 'Introduction', group: 'Getting started', source: 'docs/getting-started/introduction.md' },
  { slug: 'installation', label: 'Installation', group: 'Getting started', source: 'docs/getting-started/installation.md' },
  { slug: 'quickstart', label: 'Quickstart', group: 'Getting started', source: 'docs/getting-started/quickstart.md' },
  { slug: 'vue', label: 'Vue', group: 'Integrations', source: 'docs/integration/vue.md' },
  { slug: 'react', label: 'React', group: 'Integrations', source: 'docs/integration/react.md' },
  { slug: 'typescript', label: 'Headless TypeScript', group: 'Integrations', source: 'docs/integration/typescript.md' },
  { slug: 'nuxt', label: 'Nuxt / SSR', group: 'Integrations', source: 'docs/integration/nuxt.md' },
  { slug: 'sessions', label: 'Authentication and sessions', group: 'Core concepts', source: 'docs/concepts/sessions.md' },
  { slug: 'lifecycle', label: 'Provider lifecycle', group: 'Core concepts', source: 'docs/integration/lifecycle.md' },
  { slug: 'networks', label: 'Networks and capabilities', group: 'Core concepts', source: 'docs/concepts/networks.md' },
  { slug: 'transactions', label: 'Signing and transfers', group: 'Core concepts', source: 'docs/concepts/transactions.md' },
  { slug: 'node', label: 'Node server setup', group: 'Backend', source: 'docs/backend/node.md' },
  { slug: 'sqlite', label: 'SQLite', group: 'Backend', source: 'docs/backend/sqlite.md' },
  { slug: 'postgres', label: 'Postgres / Neon', group: 'Backend', source: 'docs/integration/postgres.md' },
  { slug: 'vercel', label: 'Vercel deployment', group: 'Backend', source: 'examples/vercel-neon/README.md' },
  { slug: 'core-api', label: 'Core API', group: 'Reference', source: 'docs/reference/core.md' },
  { slug: 'vue-api', label: 'Vue API', group: 'Reference', source: 'docs/reference/vue.md' },
  { slug: 'react-api', label: 'React API', group: 'Reference', source: 'docs/reference/react.md' },
  { slug: 'server-api', label: 'Server / storage API', group: 'Reference', source: 'docs/reference/server.md' },
  { slug: 'errors', label: 'Errors and troubleshooting', group: 'Reference', source: 'docs/reference/errors.md' },
  { slug: 'theming', label: 'Theming', group: 'Customization and advanced', source: 'docs/integration/theming.md' },
  { slug: 'wallet-adapters', label: 'Wallet adapters', group: 'Customization and advanced', source: 'docs/integration/wallet-adapters.md' },
  { slug: 'security', label: 'Security model', group: 'Customization and advanced', source: 'docs/security/model.md' },
  { slug: 'authentication-profile', label: 'Authentication profile', group: 'Customization and advanced', source: 'docs/protocol/kaspa-authentication-profile-v1.md' },
] as const satisfies readonly DocsEntry[];

export function validateManifest(entries: readonly DocsEntry[]) {
  const slugs = new Set<string>(), sources = new Set<string>();
  for (const entry of entries) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.slug) || ['catalog', 'search'].includes(entry.slug)) throw new Error(`Invalid or reserved docs slug: ${entry.slug}`);
    if (slugs.has(entry.slug) || sources.has(entry.source)) throw new Error(`Duplicate docs route or source: ${entry.slug}`);
    if (!entry.label.trim() || !entry.group.trim() || !/\.md$/.test(entry.source) || entry.source.startsWith('/') || entry.source.split('/').includes('..')) throw new Error(`Invalid docs entry: ${entry.slug}`);
    slugs.add(entry.slug); sources.add(entry.source);
  }
  if (entries[0]?.slug !== 'index') throw new Error('Documentation must begin with index');
}

export const docsPath = (slug: string) => slug === 'index' ? '/docs' : `/docs/${slug}`;
