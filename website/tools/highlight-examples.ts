import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHighlighter } from 'shiki';
import { installCommand } from '../app/data/release';

// Only the generated tokens reach the site. Grammars and the highlighter stay in the build.
export function highlightExamples() {
  const moduleId = 'virtual:ghostlink-code';
  const resolvedId = `\0${moduleId}`;
  let highlighter: ReturnType<typeof createHighlighter> | undefined;
  return {
    name: 'ghostlink-code-examples',
    resolveId(id: string) { if (id === moduleId) return resolvedId; },
    async load(this: { addWatchFile(path: string): void }, id: string) {
      if (id !== resolvedId) return;
      const renderer = await (highlighter ??= createHighlighter({
        langs: ['typescript', 'vue', 'tsx', 'shellscript'],
        themes: [{
          name: 'ghostlink',
          bg: 'var(--code)', fg: 'var(--codeInk)',
          settings: [
            { scope: ['keyword', 'storage', 'entity.name.tag'], settings: { foreground: 'var(--codeKey)' } },
            { scope: ['string', 'constant.other'], settings: { foreground: 'var(--codeStr)' } },
            { scope: ['entity.name.function', 'support.function'], settings: { foreground: 'var(--codeFn)' } },
            { scope: ['constant.numeric', 'constant.language', 'entity.name.type', 'support.type', 'entity.other.attribute-name'], settings: { foreground: 'var(--codeValue)' } },
            { scope: ['comment'], settings: { foreground: 'var(--codeCom)' } },
          ],
        }],
      }));
      const highlight = (code: string, lang: 'typescript' | 'vue' | 'tsx' | 'shellscript') =>
        renderer.codeToTokens(code, { lang, theme: 'ghostlink' }).tokens.flatMap((line, index) => [
          ...(index ? [{ content: '\n' }] : []),
          ...line.map(({ content, color }) => ({ content, color })),
        ]);
      const snippets: Record<string, unknown> = {};
      for (const [name, file, lang] of [
        ['TypeScript', 'app.ts', 'typescript'], ['Vue', 'Connect.vue', 'vue'],
        ['React', 'Connect.tsx', 'tsx'], ['Node', 'server.ts', 'typescript'],
      ] as const) {
        const path = fileURLToPath(new URL(`../snippets/${file}`, import.meta.url));
        this.addWatchFile(path);
        snippets[name] = { file, tokens: highlight(await readFile(path, 'utf8'), lang) };
      }
      const installCommands = Object.fromEntries(Object.entries({
        Vue: ['core', 'vue'], React: ['core', 'react'], TypeScript: ['core'], server: ['server'],
      }).map(([name, packages]) => [name, highlight(installCommand(...packages), 'shellscript')]));
      return `export const snippets = ${JSON.stringify(snippets)};\nexport const installCommands = ${JSON.stringify(installCommands)};`;
    },
  };
}
