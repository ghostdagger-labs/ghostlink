import { expect, it } from 'vitest';
import { createAuthClient } from './auth-client';

it('turns non-JSON origin/proxy failures into an actionable typed authentication error', async () => {
  const auth = createAuthClient({ fetch: async () => new Response('Untrusted host', { status: 400 }) });
  await expect(auth.session()).rejects.toMatchObject({ code: 'SERVER_ERROR', message: expect.stringContaining('sign-in service') });
});

it('allows lifecycle cleanup to abort an outstanding session request', async () => {
  const controller = new AbortController();
  const aborted = new Error('aborted session request');
  const auth = createAuthClient({ fetch: async (_url, options) => new Promise((_resolve, reject) => {
    expect(options?.signal).toBe(controller.signal);
    options?.signal?.addEventListener('abort', () => reject(aborted), { once: true });
  }) });
  const rejected = expect(auth.session({ signal: controller.signal })).rejects.toBe(aborted);
  controller.abort(); await rejected;
});
