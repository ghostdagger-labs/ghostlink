import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { readPackages, verifyArchives } from './release.mjs';

const root = resolve(import.meta.dirname, '..');
const { values } = parseArgs({ options: { artifacts: { type: 'string', default: 'artifacts' } } });
const artifacts = resolve(root, values.artifacts);
const version = readPackages()[0].version;
const release = verifyArchives(JSON.parse(readFileSync(join(artifacts, 'release.json'), 'utf8')), artifacts, version);
const destination = mkdtempSync(join(tmpdir(), 'ghostlink-integration-guides-'));
const run = (args, cwd, env = process.env) => execFileSync('pnpm', args, { cwd, env, stdio: 'inherit' });
let sharedServer;

for (const framework of ['vue', 'react']) {
  const source = readFileSync(join(root, `docs/integration/${framework}.md`), 'utf8');
  const files = new Map();
  for (const match of source.matchAll(/<!-- guide-file: ([\w./-]+) -->\n```\w+\n([\s\S]*?)\n```/g)) {
    const [, path, content] = match;
    assert(!path.startsWith('/') && !path.split('/').includes('..'), `Unsafe guide path: ${path}`);
    assert(!files.has(path), `Duplicate guide file: ${path}`);
    files.set(path, `${content}\n`);
  }
  const extension = framework === 'vue' ? 'vue' : 'tsx';
  for (const path of ['package.json', 'pnpm-workspace.yaml', 'tsconfig.json', 'vite.config.ts', 'index.html', '.gitignore', 'server/index.ts', 'src/private-api.ts', `src/App.${extension}`, `src/ProtectedProfile.${extension}`, `src/main.${framework === 'vue' ? 'ts' : 'tsx'}`]) {
    assert(files.has(path), `Missing copyable ${framework} file: ${path}`);
  }
  // Keep the backend contract identical in both self-contained walkthroughs.
  if (sharedServer) assert.equal(files.get('server/index.ts'), sharedServer);
  sharedServer = files.get('server/index.ts');
  const app = join(destination, framework);
  for (const [path, content] of files) {
    mkdirSync(dirname(join(app, path)), { recursive: true });
    writeFileSync(join(app, path), content);
  }
  const manifest = JSON.parse(files.get('package.json'));
  const overrides = {};
  for (const name of ['@ghostdagger/ghostlink-core', `@ghostdagger/ghostlink-${framework}`, '@ghostdagger/ghostlink-server']) {
    assert.equal(manifest.dependencies[name], version, `Update the ${framework} guide to the current release version`);
    const pkg = release.packages.find(pkg => pkg.name === name);
    assert(pkg, `Missing release package: ${name}`);
    overrides[name] = manifest.dependencies[name] = `file:${join(artifacts, pkg.filename)}`;
  }
  assert(!/\boverrides:/.test(files.get('pnpm-workspace.yaml')), 'Public guides must not need local dependency overrides');
  writeFileSync(join(app, 'package.json'), JSON.stringify(manifest, null, 2));
  writeFileSync(join(app, 'pnpm-workspace.yaml'), `${files.get('pnpm-workspace.yaml')}\noverrides:\n${Object.entries(overrides).map(([name, file]) => `  ${JSON.stringify(name)}: ${JSON.stringify(file)}`).join('\n')}\n`);
  console.log(`Checking the ${framework} guide with verified archives in ${app}`);
  run(['install', ...(process.env.GHOSTLINK_PACK_OFFLINE ? ['--offline'] : [])], app);
  run(['build'], app);
}

run(['exec', 'playwright', 'test', '--config', 'playwright.guides.config.ts'], root, {
  ...process.env, GHOSTLINK_GUIDES_DIR: destination,
});
console.log(`Guide apps passed; files and lockfiles retained for inspection: ${destination}`);
