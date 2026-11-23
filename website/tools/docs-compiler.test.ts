import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import { compileDocs, renderMarkdown, headingIds, resolveDocLink, parseDocument } from './docs-compiler';
import { docsManifest, validateManifest } from './docs-manifest';

const parse = (value: string) => unified().use(remarkParse).use(remarkGfm).parse(value);

test('invalid, duplicate and reserved routes fail before compilation', () => {
  assert.throws(() => validateManifest([...docsManifest, docsManifest[0]]), /Duplicate/);
  assert.throws(() => validateManifest([{ ...docsManifest[0], slug: '../private' }]), /Invalid/);
  assert.throws(() => validateManifest([{ ...docsManifest[0], slug: 'search' }]), /reserved/);
  assert.throws(() => validateManifest([{ ...docsManifest[0], source: '../private.md' }]), /Invalid/);
});

test('Markdown is sanitized; code is escaped and copied as literal text', async () => {
  const html = await renderMarkdown(parse('## Safe\n\n<script>alert(1)</script>\n\n[bad](javascript:alert%281%29)\n\n```html\n<img src=x onerror=alert(1)>\n```'));
  assert(!html.includes('<script>'));
  assert(!html.includes('href="javascript:'));
  assert(!html.includes('<img src=x'));
  assert(html.includes('data-copy-code="docs-code-0"'));
  assert.match(html, /&lt;|&#x3c;/i);
});

test('headings, GFM tables, nested lists and callouts retain semantic markup', async () => {
  const tree = parse('## Repeat\n\n## Repeat\n\n### `config.value`\n\n| Key | Value |\n| --- | --- |\n| A | B |\n\n- Parent\n  - Child\n\n> [!WARNING]\n> Read this first.');
  assert.deepEqual(headingIds(tree).map(h => h.id), ['repeat', 'repeat-1', 'configvalue']);
  const html = await renderMarkdown(tree);
  for (const value of ['id="repeat-1"', '<thead>', '<th>', '<ul>', 'docs-callout-warning', 'Read this first.']) assert(html.includes(value), value);
});

test('internal links preserve repository anchors and reject broken/unsafe references', async () => {
  const anchors = new Map([['docs/integration/vue.md', new Set(['3-add-the-backend'])]]);
  assert.equal(await resolveDocLink('../integration/vue.md#3-add-the-backend', 'docs/getting-started/quickstart.md', anchors), '/docs/vue#3-add-the-backend');
  assert.match(await resolveDocLink('../testing/compatibility-v1.json', 'docs/concepts/networks.md', anchors), /^https:\/\/github.com\/ghostdagger-labs\/ghostlink\/blob\/main\/docs\/testing\/compatibility-v1.json$/);
  await assert.rejects(resolveDocLink('../integration/vue.md#missing', 'docs/getting-started/quickstart.md', anchors), /missing anchor/);
  await assert.rejects(resolveDocLink('javascript:alert(1)', 'docs/concepts/networks.md', anchors), /unsafe link/);
  await assert.rejects(resolveDocLink('/docs/missing', 'docs/concepts/networks.md', anchors), /unknown docs route/);
  await assert.rejects(resolveDocLink('missing.md', 'docs/concepts/networks.md', anchors), /missing linked file/);
});

test('missing metadata, invalid review dates and multiple H1s fail the build', () => {
  assert.throws(() => parseDocument('# Title', 'test.md'), /metadata required/);
  assert.throws(() => parseDocument('---\ndescription: Hello\nupdated: "2026-02-30"\n---\n# Title', 'test.md'), /metadata required/);
  assert.throws(() => parseDocument('---\ndescription: Hello\nupdated: "2026-11-23"\n---\n# Title\n# Other', 'test.md'), /one leading H1/);
});

test('publication is explicit, raw content is exact, and navigation/search are complete', async () => {
  const result = await compileDocs();
  assert.equal(result.pages.length, 24);
  assert.equal(result.pages[0]?.previous, null);
  assert.equal(result.pages.at(-1)?.next, null);
  for (const page of result.pages) {
    assert(!page.source.includes('/design/'));
    assert(!page.source.includes('/roadmap/'));
    assert.equal(page.bytes, Buffer.byteLength(page.raw));
    assert(result.search[page.slug]?.includes(page.title.toLowerCase()));
    for (const heading of page.toc) assert(page.html.includes(`id="${heading.id}"`), `${page.slug}: ${heading.id}`);
  }
  assert(result.pages.find(p => p.slug === 'vue')?.raw.includes('<!-- guide-file: server/index.ts -->'));
  assert(result.pages.find(p => p.slug === 'react')?.raw.includes('<!-- guide-file: server/index.ts -->'));
});
