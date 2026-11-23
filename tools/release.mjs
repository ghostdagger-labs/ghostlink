import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';

export const root = resolve(import.meta.dirname, '..');
export const repository = 'ghostdagger-labs/ghostlink';
export const registry = 'https://registry.npmjs.org/';
// Dependencies must be published before their consumers.
export const packageDirectories = ['ghostlink-core', 'ghostlink-server', 'ghostlink-react', 'ghostlink-vue'];
export const packageNames = packageDirectories.map(name => `@ghostdagger/${name}`);
const run = (command, args, cwd = root) => execFileSync(command, args, { cwd, encoding: 'utf8' });
export const currentRevision = () => run('git', ['rev-parse', 'HEAD']).trim();
export const readPackages = () => packageDirectories.map(directory => JSON.parse(readFileSync(join(root, 'packages', directory, 'package.json'), 'utf8')));
export const archiveName = pkg => `${pkg.name.slice(1).replace('/', '-')}-${pkg.version}.tgz`;
const integrity = file => `sha512-${createHash('sha512').update(readFileSync(file)).digest('base64')}`;

export function releaseChannel(version) {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(alpha|beta|rc)\.(0|[1-9]\d*))?$/.exec(version ?? '');
  assert(match, 'Expected X.Y.Z or X.Y.Z-{alpha,beta,rc}.N');
  return match[4] ?? 'latest';
}

export function checkMetadata(packages, version, packed = false) {
  releaseChannel(version);
  assert.equal(packages.length, packageNames.length, 'Expected all four packages');
  for (const [index, pkg] of packages.entries()) {
    assert.equal(pkg.name, packageNames[index], 'Unexpected package name/order');
    assert.equal(pkg.version, version, 'All packages must share a version');
    assert.notEqual(pkg.private, true, 'Publishable packages cannot be private');
    assert.equal(pkg.license, 'MIT', 'Project code must declare MIT');
    assert.equal(pkg.publishConfig?.registry, registry, 'Unexpected publication registry');
    assert.equal(pkg.publishConfig?.access, 'public', 'Packages must be public');
    assert.equal(pkg.publishConfig?.tag, 'candidate', 'Direct publication must use candidate');
    assert.equal(pkg.repository?.url, `git+https://github.com/${repository}.git`, 'Unexpected source repository');
    assert.equal(pkg.repository?.directory, `packages/${packageDirectories[index]}`);
    if (index > 0) assert.equal(pkg.dependencies?.[packageNames[0]], packed ? version : 'workspace:*', 'Core must match the release exactly');
    if (packed) for (const field of ['dependencies', 'optionalDependencies', 'peerDependencies']) {
      for (const value of Object.values(pkg[field] ?? {})) assert(!/^(workspace:|file:|link:)/.test(value), 'Packed runtime dependencies must resolve from npm');
    }
  }
}

export function checkFiles(name, files) {
  assert.equal(new Set(files).size, files.length, 'Duplicate archive entries');
  for (const file of files) {
    assert(file.startsWith('package/') && !file.split('/').includes('..') && !file.includes('\\'), 'Unsafe archive path');
    const path = file.slice('package/'.length);
    assert(/^(?:(?:package\.json|README\.md|LICENSE)$|dist(?:\/|$))/.test(path) || (name.endsWith('/ghostlink-server') && /^vendor(?:\/|$)/.test(path)), `Unexpected package file: ${file}`);
    assert(!/(?:^|\/)(?:\.env(?:\.[^/]*)?|\.npmrc|node_modules|\.git)(?:\/|$)/.test(path), 'Configuration leaked into archive');
  }
  const required = ['package.json', 'README.md', 'LICENSE', 'dist/index.js', 'dist/index.d.ts'];
  if (name.endsWith('/ghostlink-core')) required.push('dist/styles.css', 'dist/fonts.css', 'dist/assets/provenance.json', 'dist/assets/KasWare-LICENSE', 'dist/assets/Kastle-LICENSE', 'dist/assets/Kaspium-LICENSE', ...['figtree', 'sora', 'jetbrains-mono'].map(font => `dist/assets/fonts/${font}-LICENSE`));
  if (name.endsWith('/ghostlink-server')) required.push('vendor/provenance.json', 'vendor/kaspa/LICENSE', 'vendor/kaspa/kaspa.js', 'vendor/kaspa/kaspa_bg.wasm', ...['server', 'postgres', 'sqlite'].flatMap(entry => [`dist/${entry}.js`, `dist/${entry}.d.ts`]));
  for (const file of required) assert(files.includes(`package/${file}`), `Missing packaged file: ${file}`);
}

function inspectArchive(file, name) {
  const files = run('tar', ['-tzf', file]).trim().split('\n').filter(Boolean).sort();
  checkFiles(name, files);
  const manifest = JSON.parse(run('tar', ['-xOf', file, 'package/package.json']));
  assert.equal(run('tar', ['-xOf', file, 'package/LICENSE']), readFileSync(join(root, 'LICENSE'), 'utf8'), 'Archive project license differs from source');
  return { files, manifest };
}

export function verifyArchives(release, directory, version, revision = currentRevision()) {
  checkMetadata(readPackages(), version);
  assert.equal(release.schemaVersion, 1);
  assert.equal(release.repository, repository);
  assert.equal(release.revision, revision, 'Release source revision does not match checkout');
  assert.equal(release.version, version, 'Release version mismatch');
  assert.equal(typeof release.dirty, 'boolean', 'Missing source cleanliness record');
  assert.equal(release.packages?.length, packageNames.length, 'Expected four release archives');
  const manifests = [];
  for (const [index, pkg] of release.packages.entries()) {
    assert.equal(pkg.name, packageNames[index], 'Unexpected archive package/order');
    assert.equal(pkg.version, version);
    assert.equal(pkg.filename, archiveName(pkg), 'Unexpected archive filename');
    const file = join(directory, pkg.filename);
    assert.equal(integrity(file), pkg.integrity, `Archive integrity mismatch: ${pkg.name}`);
    const inspected = inspectArchive(file, pkg.name);
    assert.deepEqual(inspected.files, pkg.files, 'Archive file manifest mismatch');
    manifests.push(inspected.manifest);
  }
  checkMetadata(manifests, version, true);
  return release;
}

export function prepareRelease(directory, version = readPackages()[0].version) {
  const packages = readPackages();
  checkMetadata(packages, version);
  mkdirSync(directory, { recursive: true });
  const archives = packages.map((pkg, index) => {
    run('pnpm', ['pack', '--pack-destination', directory], join(root, 'packages', packageDirectories[index]));
    const filename = archiveName(pkg);
    const file = join(directory, filename);
    const { files } = inspectArchive(file, pkg.name);
    // Repack in the same environment to catch nondeterministic build output/metadata.
    const before = integrity(file);
    run('pnpm', ['pack', '--pack-destination', directory], join(root, 'packages', packageDirectories[index]));
    assert.equal(integrity(file), before, `Non-reproducible archive: ${pkg.name}`);
    return { name: pkg.name, version, filename, integrity: before, files };
  });
  const release = { schemaVersion: 1, repository, version, revision: currentRevision(), dirty: Boolean(run('git', ['status', '--porcelain']).trim()), packages: archives };
  verifyArchives(release, directory, version);
  writeFileSync(join(directory, 'release.json'), `${JSON.stringify(release, null, 2)}\n`);
  writeFileSync(join(directory, 'SHA256SUMS'), archives.map(pkg => `${createHash('sha256').update(readFileSync(join(directory, pkg.filename))).digest('hex')}  ${pkg.filename}`).join('\n') + '\n');
  return release;
}

export function checkPublishContext(release, env = process.env) {
  assert.equal(env.GITHUB_ACTIONS, 'true', 'Automated publishing only runs in GitHub Actions');
  assert.equal(env.GITHUB_REPOSITORY, repository, 'Publishing repository mismatch');
  assert.equal(env.GITHUB_REF_TYPE, 'tag', 'Publishing requires a release tag');
  assert.equal(env.GITHUB_REF_NAME, `sdk-v${release.version}`, 'Tag must match the release version');
  assert.equal(release.dirty, false, 'Cannot publish archives prepared from a dirty checkout');
}

export function checkRegistryMetadata(actual, expected) {
  assert.equal(actual.name, expected.name);
  assert.equal(actual.version, expected.version);
  assert.equal(actual.dist?.integrity, expected.integrity, `Registry integrity mismatch: ${expected.name}`);
  assert(!actual.deprecated, `Release is deprecated: ${expected.name}`);
}

export async function checkRegistry(release, { absent = false, fetcher = fetch, attempts = 31, intervalMs = 10_000 } = {}) {
  if (absent) {
    for (const pkg of release.packages) {
      const response = await fetcher(`${registry}${encodeURIComponent(pkg.name)}/${encodeURIComponent(pkg.version)}`, { signal: AbortSignal.timeout(30_000), headers: { 'Cache-Control': 'no-cache' } });
      if (response.status === 404) continue;
      assert(response.ok, `Registry lookup failed for ${pkg.name}: HTTP ${response.status}`);
      assert.fail(`${pkg.name}@${pkg.version} already exists; inspect partial releases before retrying`);
    }
    return;
  }
  // npm processes publications asynchronously. Version endpoints can become ready
  // before the install metadata, so check the same public URL/header as consumers.
  let pending = release.packages;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const next = [];
    for (const pkg of pending) {
      const response = await fetcher(`${registry}${pkg.name.replace('/', '%2f')}`, { signal: AbortSignal.timeout(30_000), headers: { Accept: 'application/vnd.npm.install-v1+json', 'Cache-Control': 'no-cache' } });
      if (response.status === 404) { next.push(pkg); continue; }
      assert(response.ok, `Registry lookup failed for ${pkg.name}: HTTP ${response.status}`);
      const actual = (await response.json()).versions?.[pkg.version];
      if (!actual) { next.push(pkg); continue; }
      checkRegistryMetadata(actual, pkg);
      const tarballUrl = new URL(actual.dist.tarball);
      assert.equal(tarballUrl.origin, new URL(registry).origin, 'Unexpected registry tarball origin');
      const tarball = await fetcher(tarballUrl.href, { signal: AbortSignal.timeout(30_000), headers: { 'Cache-Control': 'no-cache' } });
      if (tarball.status === 404) { next.push(pkg); continue; }
      assert(tarball.ok, `Registry tarball lookup failed for ${pkg.name}: HTTP ${tarball.status}`);
      const downloadedIntegrity = `sha512-${createHash('sha512').update(Buffer.from(await tarball.arrayBuffer())).digest('base64')}`;
      assert.equal(downloadedIntegrity, pkg.integrity, `Downloaded registry tarball integrity mismatch: ${pkg.name}`);
    }
    pending = next;
    if (!pending.length) return;
    if (attempt + 1 < attempts) {
      console.log(`Waiting for npm install metadata and tarballs: ${pending.map(pkg => pkg.name).join(', ')}`);
      await delay(intervalMs);
    }
  }
  assert.fail(`npm install metadata or tarballs are not ready for ${pending.map(pkg => `${pkg.name}@${pkg.version}`).join(', ')}; inspect publication status before retrying`);
}

async function main() {
  const { values } = parseArgs({ options: { mode: { type: 'string', default: 'prepare' }, version: { type: 'string' }, out: { type: 'string', default: 'artifacts' } } });
  const version = values.version ?? readPackages()[0].version;
  const channel = releaseChannel(version);
  const directory = resolve(root, values.out);
  assert(['prepare', 'verify', 'dry-run', 'registry', 'publish', 'promote'].includes(values.mode), 'Unknown release mode');
  const release = values.mode === 'prepare' ? prepareRelease(directory, version) : verifyArchives(JSON.parse(readFileSync(join(directory, 'release.json'), 'utf8')), directory, version);
  if (['publish', 'promote'].includes(values.mode)) {
    checkPublishContext(release);
    assert.equal(run('git', ['status', '--porcelain']).trim(), '', 'Publishing checkout must be clean');
  }
  if (values.mode === 'publish') await checkRegistry(release, { absent: true });
  if (['publish', 'dry-run'].includes(values.mode)) for (const pkg of release.packages) {
    execFileSync('npm', ['publish', join(directory, pkg.filename), `--registry=${registry}`, '--access=public', '--tag=candidate', '--ignore-scripts', ...(values.mode === 'dry-run' ? ['--dry-run'] : ['--provenance'])], { cwd: root, stdio: 'inherit' });
  }
  if (['registry', 'promote'].includes(values.mode)) await checkRegistry(release);
  if (values.mode === 'promote') {
    for (const pkg of release.packages) execFileSync('npm', ['dist-tag', 'add', `${pkg.name}@${version}`, channel, `--registry=${registry}`], { cwd: root, stdio: 'inherit' });
    for (const pkg of release.packages) {
      const tags = JSON.parse(run('npm', ['dist-tag', 'ls', pkg.name, '--json', `--registry=${registry}`]));
      assert.equal(tags[channel], version, `Promotion verification failed: ${pkg.name}`);
    }
  }
  console.log(`Release ${values.mode}: ${version} (${channel}), ${release.packages.length} packages${release.dirty ? '; local checkout has uncommitted changes' : ''}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(error => { console.error(error.message); process.exitCode = 1; });
