import type { IncomingMessage, ServerResponse } from 'node:http';
import type { createGhostlinkServer } from './server.js';
/** Adapt Ghostlink Web handlers to Node HTTP. Mount under server.prefix; validates Host, limits bodies to 16 KiB, forwards cookies, and uses the socket peer for rate limits. Reverse proxies must preserve Host. */
export function createNodeHandler(server: ReturnType<typeof createGhostlinkServer>) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    try {
      if (req.headers.host !== new URL(server.origin).host) { res.writeHead(400); res.end('Untrusted host'); return; }
      const chunks: Buffer[] = []; let size = 0;
      for await (const chunk of req) { size += (chunk as Buffer).length; if (size > 16384) { res.writeHead(413); res.end('Request too large'); return; } chunks.push(chunk as Buffer); }
      const headers = new Headers();
      for (const [name, value] of Object.entries(req.headers)) if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(', ') : value);
      const request = new Request(new URL(req.url ?? '/', server.origin), { method: req.method, headers, ...(!['GET', 'HEAD'].includes(req.method ?? 'GET') ? { body: Buffer.concat(chunks) } : {}) });
      const response = await server.handle(request, { ip: req.socket.remoteAddress });
      res.statusCode = response.status;
      response.headers.forEach((value, key) => { if (key !== 'set-cookie') res.setHeader(key, value); });
      const setCookies = response.headers.getSetCookie(); if (setCookies.length) res.setHeader('Set-Cookie', setCookies);
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch { if (!res.headersSent) res.writeHead(500); res.end('Authentication service unavailable'); }
  };
}
