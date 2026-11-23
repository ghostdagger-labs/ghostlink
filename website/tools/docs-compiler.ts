import { readFile, mkdir, writeFile, stat, readdir, unlink } from 'node:fs/promises';
import { dirname, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkFrontmatter from 'remark-frontmatter';
import remarkRehype from 'remark-rehype';
import rehypeSanitize from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import { parse as parseYaml } from 'yaml';
import GithubSlugger from 'github-slugger';
import { visit, SKIP } from 'unist-util-visit';
import { createHighlighter, type BundledLanguage } from 'shiki';
import type { Root as MdRoot, Heading, Code } from 'mdast';
import type { Root as HtmlRoot, Element, ElementContent } from 'hast';
import { docsManifest, docsPath, validateManifest } from './docs-manifest';
import { repositoryUrl, releaseVersion } from '../app/data/release';
import type { DocsCatalog, DocsPage } from '../app/types/docs';

export const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
const parser = () => unified().use(remarkParse).use(remarkGfm).use(remarkFrontmatter, ['yaml']);
const plain = (node: { type?: string; value?: string; children?: unknown[] }): string => node.value ?? (node.children ?? []).map(child => plain(child as typeof node)).join('');
export const headingIds = (tree: MdRoot) => {
  const slugger = new GithubSlugger();
  const headings: { id: string; text: string; depth: number; node: Heading }[] = [];
  visit(tree, 'heading', node => { const text = plain(node); headings.push({ id: slugger.slug(text), text, depth: node.depth, node }); });
  return headings;
};
const sourceRoutes = new Map<string, string>(docsManifest.map(page => [page.source, docsPath(page.slug)]));
const repositoryLink = (path: string, hash = '') => `${repositoryUrl}/blob/main/${path.split('/').map(encodeURIComponent).join('/')}${hash}`;

export async function resolveDocLink(url: string, source: string, anchors: Map<string, Set<string>>, image = false): Promise<string> {
  if (/^(https?:|mailto:)/i.test(url)) return url;
  if (/^(?:[a-z][\w+.-]*:|\/\/)/i.test(url)) throw new Error(`${source}: unsafe link ${url}`);
  const [target = '', fragment = ''] = url.split('#');
  const hash = fragment ? `#${fragment}` : '';
  if (target.startsWith('/')) {
    const route = target.replace(/\?.*$/, '');
    const match = docsManifest.find(page => docsPath(page.slug) === route);
    if (match && fragment && !anchors.get(match.source)?.has(decodeURIComponent(fragment))) throw new Error(`${source}: missing anchor ${url}`);
    if (route.startsWith('/docs') && !match && !docsManifest.some(page => route === `/docs/${page.slug}.md`)) throw new Error(`${source}: unknown docs route ${url}`);
    return url;
  }
  const path = target ? relative(repositoryRoot, resolve(repositoryRoot, dirname(source), decodeURIComponent(target))).split(sep).join('/') : source;
  if (path.startsWith('../')) throw new Error(`${source}: link leaves repository: ${url}`);
  await stat(resolve(repositoryRoot, path)).catch(() => { throw new Error(`${source}: missing linked file ${url}`); });
  const route = sourceRoutes.get(path);
  if (route && !image) {
    if (fragment && !anchors.get(path)?.has(decodeURIComponent(fragment))) throw new Error(`${source}: missing anchor ${url}`);
    return target ? `${route}${hash}` : hash || route;
  }
  return image ? `https://raw.githubusercontent.com/ghostdagger-labs/ghostlink/main/${path.split('/').map(encodeURIComponent).join('/')}` : repositoryLink(path, hash);
}

let highlighter: ReturnType<typeof createHighlighter> | undefined;
async function highlight(code: string, lang: string) {
  const renderer = await (highlighter ??= createHighlighter({
    langs: ['typescript', 'javascript', 'vue', 'tsx', 'shellscript', 'json', 'yaml', 'css', 'html', 'sql', 'text'],
    themes: [{ name: 'docs', bg: 'var(--code)', fg: 'var(--codeInk)', settings: [
      { scope: ['keyword', 'storage', 'entity.name.tag'], settings: { foreground: 'var(--codeKey)' } },
      { scope: ['string'], settings: { foreground: 'var(--codeStr)' } },
      { scope: ['comment'], settings: { foreground: 'var(--codeCom)' } },
      { scope: ['entity.name.function', 'support.function'], settings: { foreground: 'var(--codeFn)' } },
      { scope: ['constant.numeric', 'constant.language'], settings: { foreground: 'var(--codeValue)' } },
    ] }],
  }));
  const aliases: Record<string, string> = { ts: 'typescript', js: 'javascript', sh: 'shellscript', bash: 'shellscript', shell: 'shellscript', yml: 'yaml' };
  const language = aliases[lang] ?? lang;
  const selected = renderer.getLoadedLanguages().includes(language) ? language : 'text';
  return renderer.codeToTokens(code, { lang: selected as BundledLanguage, theme: 'docs' }).tokens.flatMap((line, i) => [
    ...(i ? [{ type: 'text', value: '\n' } as ElementContent] : []),
    ...line.map(token => ({ type: 'element', tagName: 'span', properties: token.color ? { style: `color:${token.color}` } : {}, children: [{ type: 'text', value: token.content }] }) as Element),
  ]);
}

/** Pure Markdown conversion. Raw HTML is disabled; all author-supplied AST is sanitized before UI decoration. */
export async function renderMarkdown(tree: MdRoot, sourceHeadings = headingIds(tree)) {
  const processor = unified().use(remarkRehype).use(rehypeSanitize);
  const html = await processor.run(tree) as HtmlRoot;
  // IDs come only from reviewed Markdown headings, never embedded HTML or author attributes.
  // Keep GitHub-compatible fragments so repository and website links address the same section.
  const headings = sourceHeadings.filter(h => h.depth > 1);
  let headingIndex = 0;
  visit(html, 'element', node => {
    if (/^h[2-6]$/.test(node.tagName)) {
      const heading = headings[headingIndex++];
      if (heading) {
        node.properties.id = heading.id;
        node.properties.dataHeading = heading.id;
        node.children.push({ type: 'element', tagName: 'a', properties: { href: `#${heading.id}`, className: ['docs-heading-link'], ariaLabel: `Link to ${heading.text}` }, children: [{ type: 'text', value: '#' }] });
      }
    }
  });
  const pending: Promise<void>[] = [];
  let codeIndex = 0;
  visit(html, 'element', node => {
    if (node.tagName === 'pre') {
      const code = node.children.find(child => child.type === 'element' && child.tagName === 'code') as Element | undefined;
      if (!code) return;
      const lang = ((code.properties.className as string[] | undefined)?.find(c => c.startsWith('language-')) ?? 'language-text').slice(9);
      const text = plain(code).replace(/\n$/, '');
      const id = `docs-code-${codeIndex++}`;
      node.tagName = 'div'; node.properties.className = ['docs-code'];
      node.children = [
        { type: 'element', tagName: 'div', properties: { className: ['docs-code-bar'] }, children: [
          { type: 'element', tagName: 'span', properties: {}, children: [{ type: 'text', value: lang }] },
          { type: 'element', tagName: 'button', properties: { type: 'button', dataCopyCode: id, className: ['docs-copy'], ariaLabel: `Copy ${lang} code` }, children: [{ type: 'text', value: 'copy' }] },
        ] },
        { type: 'element', tagName: 'pre', properties: { tabIndex: 0, ariaLabel: `${lang} code` }, children: [code] },
      ];
      code.properties.id = id;
      pending.push(highlight(text, lang).then(tokens => { code.children = tokens; }));
      return SKIP;
    }
    if (node.tagName === 'table') {
      // Keyboard scrolling remains possible for wide tables on narrow screens.
      const table: Element = { ...node };
      node.tagName = 'div';
      node.properties = { className: ['docs-table'], tabIndex: 0, ariaLabel: 'Scrollable table' };
      node.children = [table];
      return SKIP;
    }
    if (node.tagName === 'blockquote') {
      const first = node.children.find(child => child.type === 'element' && child.tagName === 'p') as Element | undefined;
      const firstText = first?.children[0];
      if (firstText?.type !== 'text') return;
      const match = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/.exec(firstText.value);
      if (!match) return;
      firstText.value = firstText.value.slice(match[0].length);
      node.properties.className = ['docs-callout', ['WARNING', 'CAUTION'].includes(match[1]!) ? 'docs-callout-warning' : 'docs-callout-note'];
      node.children = [
        { type: 'element', tagName: 'span', properties: { className: ['docs-callout-label'] }, children: [{ type: 'text', value: ['WARNING', 'CAUTION'].includes(match[1]!) ? 'Careful' : match[1]!.toLowerCase() }] },
        { type: 'element', tagName: 'div', properties: { className: ['docs-callout-body'] }, children: node.children },
      ];
    }
  });
  await Promise.all(pending);
  return unified().use(rehypeStringify).stringify(html);
}

export interface CheckedExample { file: string; code: string; source: string }
export interface SymbolCheck { from: string; names: string[]; source: string }
export function parseDocument(raw: string, source: string) {
  const tree = parser().parse(raw);
  const yaml = tree.children.find(node => node.type === 'yaml');
  const meta = yaml && parseYaml(yaml.value) as Record<string, unknown>;
  if (!meta || typeof meta.description !== 'string' || !meta.description.trim() || typeof meta.updated !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(meta.updated) || !Number.isFinite(Date.parse(meta.updated)) || new Date(meta.updated).toISOString().slice(0, 10) !== meta.updated) throw new Error(`${source}: description and valid YYYY-MM-DD updated metadata required`);
  const headings = headingIds(tree);
  if (headings.filter(h => h.depth === 1).length !== 1 || headings[0]?.depth !== 1) throw new Error(`${source}: exactly one leading H1 required`);
  return { tree, meta, headings };
}
export async function compileDocs(output?: string) {
  validateManifest(docsManifest);
  const inputs = await Promise.all(docsManifest.map(async entry => {
    const raw = await readFile(resolve(repositoryRoot, entry.source), 'utf8');
    const { tree, meta, headings } = parseDocument(raw, entry.source);
    return { entry, raw, tree, meta, headings };
  }));
  if (new Set(inputs.map(i => i.entry.slug)).size !== inputs.length) throw new Error('Duplicate documentation slug');
  const anchors = new Map(inputs.map(i => [i.entry.source, new Set(i.headings.map(h => h.id))]));
  const search: Record<string, string> = {};
  const examples: CheckedExample[] = [];
  const symbols: SymbolCheck[] = [];
  const pages: DocsPage[] = [];
  for (const { entry, raw, tree, meta, headings } of inputs) {
    const title = headings[0]!.text;
    const searchable = tree.children.filter(node => !['yaml', 'html'].includes(node.type)).map(plain).join(' ');
    search[entry.slug] = `${entry.label} ${title} ${meta.description} ${searchable}`.replace(/\s+/g, ' ').toLowerCase();
    const api = meta.api as Record<string, string[]> | undefined;
    if (api) for (const [from, names] of Object.entries(api)) {
      if (!from.startsWith('@ghostdagger/ghostlink-') || !Array.isArray(names) || names.some(name => !/^[A-Za-z]\w*$/.test(name))) throw new Error(`${entry.source}: invalid API symbols`);
      symbols.push({ from, names, source: entry.source });
    }
    for (let i = 0; i < tree.children.length; i++) {
      const node = tree.children[i]!;
      if (node.type !== 'html') continue;
      const match = /^<!-- docs-check: ([\w.-]+\.(?:ts|tsx|vue)) -->$/.exec(node.value.trim());
      if (match) {
        const next = tree.children[i + 1];
        if (next?.type !== 'code') throw new Error(`${entry.source}: docs-check must precede a fenced example`);
        if (examples.some(e => e.file === match[1])) throw new Error(`Duplicate example filename ${match[1]}`);
        examples.push({ file: match[1]!, code: (next as Code).value, source: entry.source });
      }
    }
    const links: Promise<void>[] = [];
    visit(tree, node => {
      if (node.type === 'link' || node.type === 'definition' || node.type === 'image') links.push(resolveDocLink(node.url, entry.source, anchors, node.type === 'image').then(url => { node.url = url; }));
    });
    await Promise.all(links);
    tree.children = tree.children.filter(node => node.type !== 'yaml' && !(node.type === 'heading' && node.depth === 1));
    pages.push({ ...entry, path: docsPath(entry.slug), title, titleId: headings[0]!.id, description: meta.description as string, updated: meta.updated as string,
      readingMinutes: Math.max(1, Math.ceil(searchable.split(/\s+/).length / 220)),
      raw, bytes: Buffer.byteLength(raw), html: await renderMarkdown(tree, headings), toc: headings.filter(h => h.depth === 2 || h.depth === 3).map(({ node, ...heading }) => heading), previous: null, next: null });
  }
  pages.forEach((page, i) => {
    const neighbor = (index: number) => pages[index] ? { label: pages[index].label, path: pages[index].path } : null;
    page.previous = neighbor(i - 1); page.next = neighbor(i + 1);
  });
  const catalog: DocsCatalog = { pages: pages.map(({ html, raw, toc, bytes, previous, next, ...meta }) => meta) };
  if (output) {
    await mkdir(resolve(output, '__docs'), { recursive: true });
    await mkdir(resolve(output, 'docs'), { recursive: true });
    // A removed manifest entry must not survive as a stale public artifact.
    for (const [directory, allowed] of [
      ['__docs', new Set(['catalog.json', 'search.json', ...pages.map(page => `${page.slug}.json`)])],
      ['docs', new Set(pages.map(page => `${page.slug}.md`))],
    ] as const) {
      for (const file of await readdir(resolve(output, directory), { withFileTypes: true })) {
        if (file.isFile() && !allowed.has(file.name)) await unlink(resolve(output, directory, file.name));
      }
    }
    await writeFile(resolve(output, '__docs/catalog.json'), JSON.stringify(catalog));
    await writeFile(resolve(output, '__docs/search.json'), JSON.stringify(search));
    await Promise.all(pages.flatMap(page => [
      writeFile(resolve(output, `__docs/${page.slug}.json`), JSON.stringify(page)),
      writeFile(resolve(output, `docs/${page.slug}.md`), page.raw),
    ]));
  }
  return { pages, catalog, search, examples, symbols, releaseVersion };
}
