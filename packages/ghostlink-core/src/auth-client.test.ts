import { expect, it } from 'vitest';
import { createAuthClient } from './auth-client';

it('turns non-JSON origin/proxy failures into an actionable typed authentication error', async () => {
  const auth = createAuthClient({ fetch: async () => new Response('Untrusted host', { status: 400 }) });
  await expect(auth.session()).rejects.toMatchObject({ code: 'SERVER_ERROR', message: expect.stringContaining('sign-in service') });
});
