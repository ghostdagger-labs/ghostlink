import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { parseArgs } from 'node:util';
import { root, registry, readPackages, prepareRelease, verifyArchives, checkRegistry } from './release.mjs';

const { values } = parseArgs({ options: {
  artifacts: { type: 'string' }, 'registry-version': { type: 'string' },
  manager: { type: 'string', default: 'pnpm' },
} });
if (!['npm', 'pnpm', 'both'].includes(values.manager)) throw new Error('Choose npm, pnpm or both');
if (values['registry-version'] && !values.artifacts) throw new Error('Registry checks require the tested --artifacts directory');
const destination = resolve(root, values.artifacts ?? 'artifacts');
const packages = readPackages();
const version = values['registry-version'] ?? packages[0].version;
const release = values.artifacts
  ? verifyArchives(JSON.parse(readFileSync(join(destination, 'release.json'), 'utf8')), destination, version)
  : prepareRelease(destination, version);
if (values['registry-version']) await checkRegistry(release);
const dependencies = Object.fromEntries(release.packages.map(pkg => [pkg.name, values['registry-version'] ? version : `file:${join(destination, pkg.filename)}`]));
const installedVersion = (directory, name, fallback) => {
  const path = join(directory, 'node_modules', name, 'package.json');
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')).version : fallback;
};
const example = JSON.parse(readFileSync(join(root, 'examples/vue/package.json'), 'utf8'));
const workspace = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
for (const name of ['vue', 'react', 'react-dom']) dependencies[name] = installedVersion(join(root, 'examples/vue'), name, example.dependencies[name]);
const devDependencies = {};
for (const name of ['typescript', '@types/react', '@types/react-dom', '@types/node']) devDependencies[name] = installedVersion(root, name, workspace.devDependencies[name]);

for (const manager of values.manager === 'both' ? ['npm', 'pnpm'] : [values.manager]) {
const consumer = mkdtempSync(join(tmpdir(), `ghostlink-${manager}-consumer-`));
const manifest = { name: 'ghostlink-packed-consumer', private: true, type: 'module', dependencies, devDependencies };
if (manager === 'npm' && !values['registry-version']) manifest.overrides = Object.fromEntries(release.packages.map(pkg => [pkg.name, `$${pkg.name}`]));
writeFileSync(join(consumer, 'package.json'), JSON.stringify(manifest, null, 2));
writeFileSync(join(consumer, 'pnpm-workspace.yaml'), JSON.stringify({ packages: [], ...(!values['registry-version'] ? { overrides: Object.fromEntries(release.packages.map(pkg => [pkg.name, dependencies[pkg.name]])) } : { storeDir: join(consumer, '.pnpm-store') }) }));
writeFileSync(join(consumer, '.npmrc'), `registry=${registry}\n@ghostdagger:registry=${registry}\n`);
writeFileSync(join(consumer, 'empty-global.npmrc'), '');
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^npm_config_/i.test(key) && !/^(NODE_AUTH_TOKEN|NPM_TOKEN)$/i.test(key)));
env.npm_config_userconfig = join(consumer, '.npmrc');
env.npm_config_globalconfig = join(consumer, 'empty-global.npmrc');
if (values['registry-version']) env.npm_config_cache = join(consumer, '.npm-cache');
const run = args => execFileSync(manager, manager === 'npm' && args[0] === 'exec' ? ['exec', '--', ...args.slice(1)] : args, { cwd: consumer, env, stdio: 'inherit' });
run(['install', '--ignore-scripts', ...(process.env.GHOSTLINK_PACK_OFFLINE ? ['--offline'] : []), ...(manager === 'npm' ? ['--no-audit', '--no-fund'] : ['--config.confirmModulesPurge=false'])]);
if (!process.env.GHOSTLINK_PACK_OFFLINE) run(['audit', manager === 'npm' ? '--omit=dev' : '--prod']);
for (const pkg of release.packages) {
  const installed = JSON.parse(readFileSync(join(consumer, 'node_modules', pkg.name, 'package.json'), 'utf8'));
  if (installed.name !== pkg.name || installed.version !== version) throw new Error(`Unexpected installed package: ${pkg.name}`);
}
writeFileSync(join(consumer, 'verify.mjs'), `
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { createGhostlink, defaultAdapters } from '@ghostdagger/ghostlink-core';
import { GhostlinkProvider as ReactProvider, GhostlinkConnectButton as ReactButton, GhostlinkModal as ReactModal } from '@ghostdagger/ghostlink-react';
import { GhostlinkProvider as VueProvider, GhostlinkConnectButton as VueButton, GhostlinkModal as VueModal } from '@ghostdagger/ghostlink-vue';
import { createSqliteStorage, createGhostlinkServer, verifyKaspaSignature } from '@ghostdagger/ghostlink-server';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { createSSRApp, h } from 'vue';
import { renderToString as renderVue } from 'vue/server-renderer';
const client = createGhostlink({ app: { name: 'SSR consumer', url: 'https://app.example' } });
assert.match(renderToString(createElement(ReactProvider, { client }, createElement(ReactButton), createElement(ReactModal))), /Connect wallet/);
assert.match(await renderVue(createSSRApp({ render: () => h(VueProvider, { client }, { default: () => [h(VueButton),h(VueModal)] }) })), /Connect wallet/);
assert.equal(client.getSnapshot().initialization, 'idle');
assert.equal(client.getSnapshot().initializationError, null);
assert.deepEqual(client.getSnapshot().wallets, []);
const release = client.attach(); release(); release();
assert.equal(client.getSnapshot().initialization, 'idle');
client.destroy();
const cssPath = new URL(import.meta.resolve('@ghostdagger/ghostlink-core/styles.css'));
const fontPath = new URL(import.meta.resolve('@ghostdagger/ghostlink-core/fonts.css'));
assert.ok(fs.readFileSync(cssPath, 'utf8').includes('--ghostlink-font-body'));
for (const match of fs.readFileSync(fontPath, 'utf8').matchAll(/url\\('([^']+)'\\)/g)) assert.ok(fs.statSync(new URL(match[1], fontPath)).size > 1000);
for (const adapter of defaultAdapters()) assert.ok(fs.statSync(new URL(adapter.icon)).size > 500);
const assetProvenance = JSON.parse(fs.readFileSync(new URL('./assets/provenance.json', cssPath), 'utf8'));
for (const asset of assetProvenance) assert.equal(createHash('sha256').update(fs.readFileSync(new URL('./assets/' + asset.wallet + '.png', cssPath))).digest('hex'), asset.sha256, 'Wallet asset checksum mismatch: ' + asset.wallet);
const serverPath = new URL(import.meta.resolve('@ghostdagger/ghostlink-server'));
const provenance = JSON.parse(fs.readFileSync(new URL('../vendor/provenance.json', serverPath), 'utf8'));
for (const [file, expected] of Object.entries(provenance.files)) assert.equal(createHash('sha256').update(fs.readFileSync(new URL('../vendor/kaspa/' + file, serverPath))).digest('hex'), expected);
const require = createRequire(import.meta.url);
const sdk = require(new URL('../vendor/kaspa/kaspa.js', serverPath).pathname);
assert.equal(sdk.version(), '2.0.1');
const key = new sdk.PrivateKey('3'.padStart(64,'0')); const publicKey = key.toPublicKey(); const address = publicKey.toAddress('testnet-11');
assert.ok(verifyKaspaSignature({ address: address.toString(), network: 'testnet-11', message: 'Hello Kaspa!', signature: '40b9bb2be0ae02607279eda64015a8d86e3763279170340b8243f7ce5344d77aff1191598baf2fd26149cac3b4b12c2c433261c00834db6098cb172aa48ef522' }));
address.free(); publicKey.free(); key.free();
const storage = createSqliteStorage(':memory:'); const server = createGhostlinkServer({ origin: 'https://app.example', loginUri: 'https://app.example/login', storage });
assert.equal((await server.handle(new Request('https://app.example/auth/ghostlink/session'))).status, 200); storage.close();
console.log('Clean consumer: Vue/React SSR, CSS, fonts, wallet assets, Node SQLite and official WASM verification passed.');
`);
execFileSync(process.execPath, ['verify.mjs'], { cwd: consumer, stdio: 'inherit' });
writeFileSync(join(consumer, 'verify.ts'), `
import { createGhostlink, type AuthSession, type AuthenticationListener, type InitializationState, type TransactionRequest } from '@ghostdagger/ghostlink-core';
import { GhostlinkProvider as VueProvider, useGhostlink as useVue } from '@ghostdagger/ghostlink-vue';
import { GhostlinkProvider as ReactProvider, useGhostlink as useReact } from '@ghostdagger/ghostlink-react';
import { createGhostlinkServer, createSqliteStorage } from '@ghostdagger/ghostlink-server';
const client = createGhostlink({ app: { name: 'Typed consumer', url: 'https://app.example' }, closeOnAuthenticate: false });
const onAuthenticated: AuthenticationListener = async session => { const address: string = session.address; void address; };
const unsubscribe: () => void = client.onAuthenticated(onAuthenticated);
const authenticate: () => Promise<Readonly<AuthSession>> = () => client.authenticate();
const release: () => void = client.attach();
const initialization: InitializationState = client.getSnapshot().initialization;
void [unsubscribe, authenticate, release, initialization];
const request: TransactionRequest = { format: 'pskt-json', payload: '{}', network: 'testnet-11', address: 'kaspatest:fixture' };
void [client, request, VueProvider, ReactProvider, useVue, useReact, createGhostlinkServer, createSqliteStorage];
`);
writeFileSync(join(consumer, 'snapshot-contract.ts'), readFileSync(join(root, 'tests/consumer/snapshot-contract.ts')));
run(['exec', 'tsc', '--noEmit', '--strict', '--target', 'ES2022', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', '--skipLibCheck', 'false', 'verify.ts', 'snapshot-contract.ts']);
writeFileSync(join(consumer, 'public-api-docs.mjs'), readFileSync(join(root, 'tests/consumer/public-api-docs.mjs')));
execFileSync(process.execPath, ['public-api-docs.mjs'], { cwd: consumer, stdio: 'inherit' });
console.log(`${manager} clean consumer passed: ${consumer}`);
}
if (!values['registry-version']) {
  const frontendFiles = readdirSync(join(root, 'examples/vue/dist/assets')).filter(file => file.endsWith('.js'));
  for (const file of frontendFiles) if (/node:(?:sqlite|fs|crypto)|kaspa_bg\.wasm|DatabaseSync/.test(readFileSync(join(root, 'examples/vue/dist/assets', file), 'utf8'))) throw new Error('Server dependency leaked into the browser bundle.');
}
// Consumer checks must never replace or repack the release job's verified artifacts.
verifyArchives(release, destination, version);
console.log(`Verified release artifacts: ${destination}`);
