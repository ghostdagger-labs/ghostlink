import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { compileDocs, repositoryRoot } from './docs-compiler';

const { pages, examples, symbols, releaseVersion } = await compileDocs();
assert(symbols.length >= 4, 'All four package references must declare checked API symbols');
const buildDir = resolve(repositoryRoot, 'website/.nuxt');
await mkdir(buildDir, { recursive: true });
const checks = await mkdtemp(join(buildDir, 'docs-check-'));
try {
  for (const example of examples) await writeFile(join(checks, example.file), example.code + '\n');
  const imports: string[] = [];
  let index = 0;
  for (const check of symbols) {
    const page = pages.find(page => page.source === check.source)!;
    for (const name of check.names) {
      assert(page.raw.slice(page.raw.indexOf('\n---', 4) + 4).includes(name), `${check.source}: describe ${name} in the reference body`);
      imports.push(`import type { ${name} as CheckedSymbol${index++} } from ${JSON.stringify(check.from)};`);
    }
  }
  await writeFile(join(checks, 'api-symbols.ts'), imports.join('\n'));
  const paths: Record<string, string[]> = {};
  for (const name of ['core', 'vue', 'react', 'server']) {
    const directory = process.env.GHOSTLINK_DOCS_PACKAGES
      ? resolve(process.env.GHOSTLINK_DOCS_PACKAGES, name, 'package')
      : resolve(repositoryRoot, `packages/ghostlink-${name}`);
    const manifest = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'));
    assert.equal(manifest.version, releaseVersion, `${name}: documented version must match tested package`);
    paths[`@ghostdagger/ghostlink-${name}`] = [join(directory, manifest.types)];
    if (name === 'server') for (const subpath of ['server', 'postgres', 'sqlite']) {
      paths[`@ghostdagger/ghostlink-server/${subpath}`] = [join(directory, manifest.exports[`./${subpath}`].types)];
    }
  }
  await writeFile(join(checks, 'tsconfig.json'), JSON.stringify({
    compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', strict: true, skipLibCheck: true, jsx: 'react-jsx', lib: ['ES2022', 'DOM'], types: ['node', 'react'], noEmit: true, paths },
    include: ['*.ts', '*.tsx', '*.vue'],
  }));
  execFileSync('pnpm', ['exec', 'vue-tsc', '--noEmit', '-p', join(checks, 'tsconfig.json')], { cwd: resolve(repositoryRoot, 'website'), stdio: 'inherit' });
  console.log(`Documentation checks passed: ${pages.length} pages, ${index} public symbols, ${examples.length} compiled examples; SDK ${releaseVersion}${process.env.GHOSTLINK_DOCS_PACKAGES ? ' (published archives)' : ' (workspace declarations)'}.`);
} finally {
  // Only remove this invocation's generated scratch directory.
  await rm(checks, { recursive: true, force: true });
}
