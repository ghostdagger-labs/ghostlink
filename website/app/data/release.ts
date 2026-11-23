// Verified against the public npm registry and package archives on 2026-11-23.
// Keep marketing examples tied to a published release, not workspace-only exports.
export const releaseVersion = '0.1.0-beta.2';
export const repositoryUrl = 'https://github.com/ghostdagger-labs/ghostlink';
export const guideUrl = (name: string) => `${repositoryUrl}/blob/main/docs/integration/${name}.md`;
export const npmUrl = (name: string) => `https://www.npmjs.com/package/@ghostdagger/ghostlink-${name}/v/${releaseVersion}`;
export const installCommand = (...names: string[]) => `npm install ${names.map(name => `@ghostdagger/ghostlink-${name}@${releaseVersion}`).join(' ')}`;

export const packages = [
  { id: 'core', title: 'Your wallet workflow, in TypeScript.', description: 'Connect a wallet, request a login signature, and restore a verified session with one framework-neutral controller.', api: 'createGhostlink · authenticate · restoreSession', guide: `${repositoryUrl}#client-operations` },
  { id: 'vue', title: 'A login flow that feels like Vue.', description: 'Add a connect button and modal, then read session state with useGhostlink(). Use the plugin or a component-level provider.', api: 'GhostlinkPlugin · GhostlinkModal · useGhostlink', guide: guideUrl('vue') },
  { id: 'react', title: 'Wallet login, ready for React.', description: 'Mount a provider, render the button and modal, and use the hook in your own components. Supports React 18.3 and 19.', api: 'GhostlinkProvider · GhostlinkModal · useGhostlink', guide: guideUrl('react') },
  { id: 'server', title: 'Verification on your backend.', description: 'Verify login signatures and manage revocable sessions on Node 24. Store them in SQLite or Postgres, including Neon.', api: 'createGhostlinkServer · createSqliteStorage · createPostgresStorage', guide: guideUrl('vue') + '#3-add-the-backend' },
];
