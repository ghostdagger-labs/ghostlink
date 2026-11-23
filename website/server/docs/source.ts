import { documents } from '#docs-generated';
import type { DocsPage } from '../../app/types/docs';

/** Exact routes are registered from the publication manifest for development. */
export default defineEventHandler(async event => {
  const slug = getRequestURL(event).pathname.split('/').at(-1)?.replace(/\.md$/, '') ?? '';
  const file = `${slug}.json`;
  if (!Object.hasOwn(documents, file)) throw createError({ statusCode: 404 });
  const page = await documents[file]!() as DocsPage;
  setHeader(event, 'Content-Type', 'text/markdown; charset=utf-8');
  setHeader(event, 'Cache-Control', 'no-cache');
  return page.raw;
});
