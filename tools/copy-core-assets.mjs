import { cp, mkdir, readdir, writeFile, copyFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
const root = new URL('../packages/ghostlink-core/', import.meta.url);
const require = createRequire(new URL('package.json', root));
await mkdir(new URL('dist/assets/fonts/', root), { recursive: true });
await copyFile(new URL('src/styles.css', root), new URL('dist/styles.css', root));
let css = '';
for (const [id, name, weights] of [['figtree', 'Figtree', [400,500,600,700,800]], ['space-grotesk', 'Space Grotesk', [400,500,600,700]], ['jetbrains-mono', 'JetBrains Mono', [400,500,600]]]) {
  const directory = dirname(require.resolve(`@fontsource/${id}/package.json`));
  for (const weight of weights) {
    const filename = `${id}-latin-${weight}-normal.woff2`;
    await copyFile(join(directory, 'files', filename), new URL(`dist/assets/fonts/${filename}`, root));
    css += `@font-face{font-family:'${name}';font-style:normal;font-weight:${weight};font-display:swap;src:url('./assets/fonts/${filename}') format('woff2')}\n`;
  }
  const files = await readdir(directory); const license = files.find(f => /^(license|ofl)/i.test(f));
  if (license) await copyFile(join(directory, license), new URL(`dist/assets/fonts/${id}-LICENSE`, root));
}
await writeFile(new URL('dist/fonts.css', root), css);
try { await cp(new URL('src/assets/', root), new URL('dist/assets/', root), { recursive: true }); } catch (e) { if (e.code !== 'ENOENT') throw e; }
