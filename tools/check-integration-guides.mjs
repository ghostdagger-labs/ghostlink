import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
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
  mkdirSync(join(app, 'vendor'));
  for (const name of ['ghostlink-core', `ghostlink-${framework}`, 'ghostlink-server']) {
    const archive = `${name}-0.1.0.tgz`;
    assert(existsSync(join(root, 'artifacts', archive)), `Run pnpm build and pnpm check:package first: missing ${archive}`);
    copyFileSync(join(root, 'artifacts', archive), join(app, 'vendor', archive));
  }
  console.log(`Checking the exact ${framework} guide files in ${app}`);
  run(['install', ...(process.env.GHOSTLINK_PACK_OFFLINE ? ['--offline'] : [])], app);
  run(['build'], app);
}

run(['exec', 'playwright', 'test', '--config', 'playwright.guides.config.ts'], root, {
  ...process.env, GHOSTLINK_GUIDES_DIR: destination,
});
console.log(`Guide apps passed; files and lockfiles retained for inspection: ${destination}`);
