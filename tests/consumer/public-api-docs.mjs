import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';

// Exercise the same QuickInfo API used by editors, against an installed consumer.
// Checking source comments alone misses documentation lost by declaration bundling/re-exports.
const filename = resolve('hover-contract.ts');
const checks = [
  ['createGhostlink', 'createGhostlink', [/passive/i, /SSR/i]],
  ['createAuthClient', 'createAuthClient', [/same-origin/i, /CSRF/]],
  ['snapshot', 'client.getSnapshot', [/read-only/i, /stable/i]],
  ['subscribe', 'client.subscribe', [/unsubscribe/i]],
  ['completion', 'client.onAuthenticated', [/restoration/i, /unsubscribe/i]],
  ['attach', 'client.attach', [/release/i, /server/i]],
  ['connect', 'client.connect', [/revoke/i, /authenticate/i]],
  ['authenticate', 'client.authenticate', [/verified|verification/i, /approval/i]],
  ['restore', 'client.restoreSession', [/initializationError/, /readiness/i]],
  ['logout', 'client.disconnect', [/revocationPending/, /offline/i]],
  ['network-change', 'client.setNetwork', [/signs out/i, /no-op/i]],
  ['wallet-network', 'client.switchWalletNetwork', [/UNSUPPORTED/, /application network/i]],
  ['balance', 'client.refreshBalance', [/sompi/i, /null/i]],
  ['sign', 'client.signMessage', [/approval/i, /BUSY/]],
  ['transaction', 'client.signTransaction', [/never broadcasts/i]],
  ['transfer', 'client.sendTransaction', [/broadcast/i, /sompi/i]],
  ['destroy', 'client.destroy', [/permanently/i, /effect cleanup/i]],
  ['readiness', 'snapshot.initialization', [/ready/i, /restoreSession/]],
  ['session', 'snapshot.session', [/retained/i, /signed out/i]],
  ['capabilities', 'snapshot.wallets[0]!.capabilities', [/read-only/i]],
  ['network-default', 'config.network', [/testnet-11/]],
  ['adapters-default', 'config.adapters', [/KasWare/, /Kastle/, /unique/i]],
  ['close-default', 'config.closeOnAuthenticate', [/true/, /restoration/i]],
  ['app-url', 'config.app.url', [/origin/i, /HTTP/]],
  ['auth-url', 'http.baseUrl', [/trailing slash/i, /\/auth\/ghostlink/]],
  ['auth-fetch', 'http.fetch', [/same-origin/i]],
  ['server-factory', 'createGhostlinkServer', [/storage shutdown/i]],
  ['server-session', 'auth.getSession', [/idle expiry/i, /authorization/i, /CSRF/]],
  ['server-handler', 'auth.handle', [/rate limits/i]],
  ['server-origin', 'policy.origin', [/trailing slash/i]],
  ['challenge-ttl', 'policy.challengeTtlMs', [/milliseconds/i, /300_000/]],
  ['session-ttl', 'policy.sessionTtlMs', [/milliseconds/i, /86_400_000/]],
  ['idle-ttl', 'policy.idleTtlMs', [/milliseconds/i, /1_800_000/]],
  ['local-http', 'policy.allowInsecureLocalhost', [/false/, /loopback/i]],
  ['storage', 'createSqliteStorage', [/Node 24/, /close/i]],
  ['postgres-storage', 'createPostgresStorage', [/Neon/, /pool.end/, /primary/i]],
  ['postgres-migration', 'migratePostgresStorage', [/deployment/i, /concurrently/i, /pool.end/]],
  ['storage-shutdown', 'storage.close', [/shutdown/i]],
  ['node-handler', 'createNodeHandler', [/Host/, /socket peer/i]],
  ['react-provider', 'ReactProvider', [/stable client/i, /Strict Mode/i]],
  ['react-hook', 'useReact', [/readonly/i, /ready/]],
  ['react-button', 'ReactButton', [/provider/i]],
  ['react-modal', 'ReactModal', [/one modal/i]],
  ['react-theme', 'reactProps.theme', [/dark/]],
  ['react-label', 'reactProps.label', [/Connect wallet/]],
  ['vue-plugin', 'GhostlinkPlugin', [/SSR/, /unmount/i]],
  ['vue-provider', 'VueProvider', [/stable client/i, /SSR/]],
  ['vue-hook', 'useVue', [/readonly/i, /snapshot.value/]],
  // Vue's derived $props can lose comment metadata through framework mapped types.
  // Require prop defaults on the component hover itself as well as source prop comments.
  ['vue-button', 'VueButton', [/readonly/i, /provider/i, /dark/, /Connect wallet/, /--ghostlink-/]],
  ['vue-modal', 'VueModal', [/one modal/i, /dark/, /--ghostlink-/]],
];
let source = `
import { createGhostlink, createAuthClient, type GhostlinkConfig, type GhostlinkSnapshot } from '@ghostdagger/ghostlink-core';
import { createGhostlinkServer, createNodeHandler, createSqliteStorage, type GhostlinkServerConfig, type GhostlinkStorage } from '@ghostdagger/ghostlink-server';
import { createPostgresStorage, migratePostgresStorage } from '@ghostdagger/ghostlink-server/postgres';
import { GhostlinkProvider as ReactProvider, GhostlinkConnectButton as ReactButton, GhostlinkModal as ReactModal, useGhostlink as useReact } from '@ghostdagger/ghostlink-react';
import { GhostlinkPlugin, GhostlinkProvider as VueProvider, GhostlinkConnectButton as VueButton, GhostlinkModal as VueModal, useGhostlink as useVue } from '@ghostdagger/ghostlink-vue';
import type { ComponentProps } from 'react';
declare const client: ReturnType<typeof createGhostlink>;
declare const snapshot: GhostlinkSnapshot;
declare const config: GhostlinkConfig;
declare const http: NonNullable<Parameters<typeof createAuthClient>[0]>;
declare const auth: ReturnType<typeof createGhostlinkServer>;
declare const policy: GhostlinkServerConfig;
declare const storage: GhostlinkStorage;
declare const reactProps: ComponentProps<typeof ReactButton>;
`;
const positions = new Map();
for (const [label, expression] of checks) {
  // Position on the last identifier, so a property check reads that property's own hover.
  const offset = expression.lastIndexOf('.') + 1;
  positions.set(label, source.length + offset);
  source += `${expression};\n`;
}
writeFileSync(filename, source);
const options = { strict: true, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext };
const service = ts.createLanguageService({
  getScriptFileNames: () => [filename],
  getScriptVersion: () => '0',
  getScriptSnapshot: file => ts.sys.fileExists(file) ? ts.ScriptSnapshot.fromString(readFileSync(file, 'utf8')) : undefined,
  getCurrentDirectory: () => process.cwd(),
  getCompilationSettings: () => options,
  getDefaultLibFileName: ts.getDefaultLibFilePath,
  fileExists: ts.sys.fileExists, readFile: ts.sys.readFile, readDirectory: ts.sys.readDirectory,
});
try {
  const diagnostics = [...service.getSyntacticDiagnostics(filename), ...service.getSemanticDiagnostics(filename)];
  assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: file => file, getCurrentDirectory: () => process.cwd(), getNewLine: () => '\n',
  }));
  for (const [label, , expectations] of checks) {
    const info = service.getQuickInfoAtPosition(filename, positions.get(label));
    const documentation = ts.displayPartsToString(info?.documentation);
    assert(documentation.trim(), `${label}: documentation did not survive packaging`);
    for (const expected of expectations) assert.match(documentation, expected, `${label}: missing contract guidance`);
  }
  console.log(`Installed-package hover documentation: ${checks.length} contracts passed.`);
} finally { service.dispose(); }
