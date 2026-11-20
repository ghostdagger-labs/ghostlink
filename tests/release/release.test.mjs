import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { archiveName, checkFiles, checkMetadata, checkPublishContext, checkRegistry, checkRegistryMetadata, packageNames, readPackages, releaseChannel, repository, verifyArchives } from '../../tools/release.mjs';

test('release channels require canonical versions and cannot inject command arguments', () => {
  assert.equal(releaseChannel('0.1.0-beta.1'), 'beta');
  assert.equal(releaseChannel('1.2.3-rc.0'), 'rc');
  assert.equal(releaseChannel('1.2.3'), 'latest');
  for (const bad of ['v1.2.3', '01.2.3', '1.2.3-beta.01', '1.2.3+build', '1.2.3;echo bad', '--tag latest', '1.2.3-next']) assert.throws(() => releaseChannel(bad));
});

test('all packages share the owner, registry, public access, MIT license and exact core version', () => {
  const packages = readPackages();
  const version = packages[0].version;
  checkMetadata(packages, version);
  for (const mutate of [p => p[0].name = 'ghostlink-core', p => p[1].version = '8.0.0', p => p[0].private = true, p => p[0].license = undefined, p => p[0].publishConfig.registry = 'https://npm.pkg.github.com', p => p[0].publishConfig.access = 'restricted', p => p[0].publishConfig.tag = 'latest', p => p[0].repository.url = 'git+https://github.com/other/repo.git', p => p[1].dependencies[packageNames[0]] = 'workspace:^']) {
    const modified = structuredClone(packages); mutate(modified);
    assert.throws(() => checkMetadata(modified, version));
  }
  const packed = structuredClone(packages);
  for (const pkg of packed.slice(1)) pkg.dependencies[packageNames[0]] = version;
  checkMetadata(packed, version, true);
  packed[0].dependencies.accident = 'file:../local';
  assert.throws(() => checkMetadata(packed, version, true));
  assert.equal(archiveName(packages[0]), `ghostdagger-ghostlink-core-${version}.tgz`);
});

test('archive checks require entry points and reject configuration, traversal and duplicates', () => {
  const files = ['package.json', 'README.md', 'LICENSE', 'dist/index.js', 'dist/index.d.ts'].map(file => `package/${file}`);
  checkFiles(packageNames[2], files);
  assert.throws(() => checkFiles(packageNames[2], files.filter(file => !file.endsWith('index.js'))));
  for (const bad of ['package/dist/.env', 'package/.npmrc', 'package/dist/../../secret', '/etc/passwd', 'package/src/test.ts', 'package/LICENSE', 'package/LICENSE.private']) assert.throws(() => checkFiles(packageNames[2], [...files, bad]));
});

test('downloaded artifacts must match the source revision, expected filenames and archive hashes', () => {
  const version = readPackages()[0].version;
  const directory = mkdtempSync(join(tmpdir(), 'ghostlink-release-test-'));
  const release = { schemaVersion: 1, repository, revision: 'reviewed-commit', version, dirty: false, packages: packageNames.map(name => ({ name, version, filename: archiveName({ name, version }), integrity: 'sha512-original', files: [] })) };
  try {
    assert.throws(() => verifyArchives(release, directory, version, 'different-commit'), /source revision/);
    const changed = structuredClone(release);
    changed.packages[0].filename = '../elsewhere.tgz';
    assert.throws(() => verifyArchives(changed, directory, version, release.revision), /filename/);
    writeFileSync(join(directory, release.packages[0].filename), 'replaced archive');
    assert.throws(() => verifyArchives(release, directory, version, release.revision), /integrity mismatch/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('publication rejects dirty artifacts, forks, branches and mismatched tags', () => {
  const release = { version: '0.1.0-beta.1', dirty: false };
  const env = { GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: repository, GITHUB_REF_TYPE: 'tag', GITHUB_REF_NAME: 'sdk-v0.1.0-beta.1' };
  checkPublishContext(release, env);
  assert.throws(() => checkPublishContext({ ...release, dirty: true }, env));
  for (const change of [{ GITHUB_ACTIONS: undefined }, { GITHUB_REPOSITORY: 'someone/ghostlink' }, { GITHUB_REF_TYPE: 'branch' }, { GITHUB_REF_NAME: 'sdk-v0.1.0' }]) assert.throws(() => checkPublishContext(release, { ...env, ...change }));
});

test('registry verification checks exact archive integrity and refuses deprecated versions', () => {
  const expected = { name: packageNames[0], version: '0.1.0-beta.1', integrity: 'sha512-tested' };
  const actual = { ...expected, dist: { integrity: expected.integrity } };
  checkRegistryMetadata(actual, expected);
  assert.throws(() => checkRegistryMetadata({ ...actual, dist: { integrity: 'sha512-other' } }, expected));
  assert.throws(() => checkRegistryMetadata({ ...actual, deprecated: 'broken' }, expected));
});

test('only an explicit registry 404 permits publishing; partial releases and network errors stop it', async () => {
  const release = { packages: packageNames.map(name => ({ name, version: '0.1.0-beta.1', integrity: 'sha512-tested' })) };
  await checkRegistry(release, { absent: true, fetcher: async () => new Response('', { status: 404 }) });
  for (const status of [200, 401, 403, 429, 500]) await assert.rejects(checkRegistry(release, { absent: true, fetcher: async () => new Response('{}', { status }) }));
  await assert.rejects(checkRegistry(release, { absent: true, fetcher: async () => { throw new Error('offline'); } }));
  let index = 0;
  await assert.rejects(checkRegistry(release, { absent: true, fetcher: async () => new Response('{}', { status: index++ === 0 ? 404 : 200 }) }));
});

test('registry verification waits for install metadata after npm accepts a publication', async () => {
  const contents = 'tested archive';
  const pkg = { name: packageNames[0], version: '0.1.0-beta.1', integrity: `sha512-${createHash('sha512').update(contents).digest('base64')}` };
  const tarball = 'https://registry.npmjs.org/@ghostdagger/ghostlink-core/-/ghostlink-core-0.1.0-beta.1.tgz';
  let calls = 0;
  let downloads = 0;
  await checkRegistry({ packages: [pkg] }, { attempts: 4, intervalMs: 0, fetcher: async (url, options) => {
    if (url === tarball) return ++downloads === 1 ? new Response('', { status: 404 }) : new Response(contents);
    assert.equal(url, 'https://registry.npmjs.org/@ghostdagger%2fghostlink-core');
    assert.equal(options.headers.Accept, 'application/vnd.npm.install-v1+json');
    calls++;
    if (calls === 1) return new Response('', { status: 404 });
    const versions = calls === 2 ? { '0.0.0-stage': {} } : { [pkg.version]: { name: pkg.name, version: pkg.version, dist: { integrity: pkg.integrity, tarball } } };
    return Response.json({ versions });
  } });
  assert.equal(calls, 4);
  assert.equal(downloads, 2);
});

test('registry verification rejects tampered downloads and unexpected tarball origins', async () => {
  const pkg = { name: packageNames[0], version: '0.1.0-beta.1', integrity: 'sha512-tested' };
  for (const tarball of ['https://registry.npmjs.org/test.tgz', 'https://elsewhere.invalid/test.tgz']) {
    await assert.rejects(checkRegistry({ packages: [pkg] }, { attempts: 1, fetcher: async url => url === tarball
      ? new Response('replaced archive')
      : Response.json({ versions: { [pkg.version]: { name: pkg.name, version: pkg.version, dist: { integrity: pkg.integrity, tarball } } } })
    }), /integrity mismatch|Unexpected registry tarball origin/);
  }
});

test('registry propagation retries are bounded and never conceal bad archives or access failures', async () => {
  const pkg = { name: packageNames[0], version: '0.1.0-beta.1', integrity: 'sha512-tested' };
  let calls = 0;
  await assert.rejects(checkRegistry({ packages: [pkg] }, { attempts: 2, intervalMs: 0, fetcher: async () => { calls++; return new Response('', { status: 404 }); } }), /not ready/);
  assert.equal(calls, 2);
  for (const response of [new Response('', { status: 403 }), Response.json({ versions: { [pkg.version]: { name: pkg.name, version: pkg.version, dist: { integrity: 'sha512-replaced' } } } })]) {
    calls = 0;
    await assert.rejects(checkRegistry({ packages: [pkg] }, { attempts: 3, intervalMs: 0, fetcher: async () => { calls++; return response; } }));
    assert.equal(calls, 1);
  }
});
