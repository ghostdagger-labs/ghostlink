import { documents } from '#docs-generated';

/** Compiled, public documentation only. No source filesystem or auth runtime access. */
export default defineEventHandler(async event => {
  const file = getRouterParam(event, 'file') ?? '';
  if (!Object.hasOwn(documents, file)) throw createError({ statusCode: 404, statusMessage: 'Documentation data not found' });
  setHeader(event, 'Cache-Control', 'no-cache');
  return documents[file]!();
});
