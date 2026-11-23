import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

// Vercel consumes Next's traces when packaging functions. Fail the build if the
// dynamically loaded official WASM or its JS loader would be omitted.
for (const route of ['auth/ghostlink/[...path]', 'api/private']) {
  const trace = resolve(`.next/server/app/${route}/route.js.nft.json`);
  const files = JSON.parse(readFileSync(trace, 'utf8')).files.map(file => resolve(dirname(trace), file));
  for (const filename of ['kaspa.js', 'kaspa_bg.wasm', 'package.json']) {
    assert.ok(files.some(file => file.endsWith(`/vendor/kaspa/${filename}`)), `Missing bundled Kaspa ${filename}: ${route}`);
  }
}
for (const file of readdirSync('.next/static', { recursive: true })) {
  if (!file.endsWith('.js')) continue;
  assert.doesNotMatch(readFileSync(resolve('.next/static', file), 'utf8'), /node:(?:sqlite|fs|crypto)|kaspa_bg\.wasm|DatabaseSync|postgresql:\/\//, `Server code leaked into ${file}`);
}
console.log('Verified function WASM traces and browser/server separation.');
