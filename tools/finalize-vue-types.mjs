import { copyFileSync, readdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '../packages/ghostlink-vue');
copyFileSync(resolve(root, '.types/index.d.d.ts'), resolve(root, 'dist/index.d.ts'));
for (const file of readdirSync(resolve(root, 'dist'))) if (file.endsWith('.d.ts') && file !== 'index.d.ts') rmSync(resolve(root, 'dist', file));
rmSync(resolve(root, '.types'), { recursive: true });
