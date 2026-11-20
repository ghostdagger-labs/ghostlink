import { GhostlinkError } from './types.js';
import type { AuthTransport, AuthChallenge, AuthSession } from './types.js';
export function createAuthClient(options: { baseUrl?: string; fetch?: typeof fetch } = {}): AuthTransport {
  const base = options.baseUrl ?? '/auth/ghostlink';
  let csrf: string | null = null;
  let bootstrap: Promise<void> | null = null;
  const fetcher = options.fetch ?? ((...args: Parameters<typeof fetch>) => globalThis.fetch(...args));
  async function request<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
    const response = await fetcher(`${base}${path}`, {
      method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin', cache: 'no-store',
      headers: body === undefined ? {} : { 'Content-Type': 'application/json', 'X-Ghostlink-CSRF': csrf ?? '' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      ...(signal ? { signal } : {}),
    });
    let data: Record<string, unknown>;
    try { data = await response.json() as Record<string, unknown>; }
    catch { throw new GhostlinkError('SERVER_ERROR', 'Could not reach this application’s sign-in service. Reload the page and try again.'); }
    if (!response.ok) throw new GhostlinkError((data.code as GhostlinkError['code']) || 'SERVER_ERROR', typeof data.error === 'string' ? data.error : 'Authentication service unavailable.');
    return data as T;
  }
  async function ensureCsrf() {
    if (csrf) return;
    bootstrap ??= request<{ csrfToken: string }>('/session').then(data => { csrf = data.csrfToken; }).finally(() => { bootstrap = null; });
    await bootstrap;
  }
  return {
    async challenge(account) { await ensureCsrf(); return request<AuthChallenge>('/challenge', account); },
    async verify(input) { await ensureCsrf(); return request<AuthSession>('/verify', input); },
    async session(options) { const data = await request<{ session: AuthSession | null; csrfToken: string }>('/session', undefined, options?.signal); csrf = data.csrfToken; return data.session; },
    async logout() { await ensureCsrf(); await request('/logout', {}); },
  };
}
