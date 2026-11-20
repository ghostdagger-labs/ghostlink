import { createServer } from 'node:http';
import sirv from 'sirv';
import { createGhostlinkServer, createNodeHandler, createSqliteStorage } from '@ghostdagger/ghostlink-server';
const port = Number(process.env.PORT ?? 5174);
const origin = process.env.GHOSTLINK_ORIGIN ?? 'http://127.0.0.1:5174';
const storage = createSqliteStorage(process.env.GHOSTLINK_DATABASE ?? '.data/ghostlink.sqlite');
const auth = createGhostlinkServer({ origin, loginUri: `${origin}/login`, networks: ['mainnet', 'testnet-10', 'testnet-11'], storage, allowInsecureLocalhost: true });
const handler = createNodeHandler(auth);
const serve = sirv('dist', { single: true });
const server = createServer(async (req, res) => {
  if (req.url?.startsWith('/auth/ghostlink/')) { await handler(req, res); return; }
  if (req.url === '/api/private') {
    if (req.method !== 'GET' || req.headers.host !== new URL(origin).host || req.headers['sec-fetch-site'] === 'cross-site') { res.writeHead(403); res.end(); return; }
    const request = new Request(`${origin}/api/private`, { headers: { cookie: req.headers.cookie ?? '' } });
    const session = await auth.getSession(request);
    res.writeHead(session ? 200 : 401, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(session ? { message: 'Your protected backend request succeeded.', accountId: session.accountId } : { error: 'Sign in first.' })); return;
  }
  serve(req, res);
});
server.listen(port, '127.0.0.1', () => console.log(`Ghostlink example backend listening on ${port}; trusted application ${origin}`));
function close() { server.close(() => { storage.close?.(); process.exit(); }); }
process.on('SIGTERM', close); process.on('SIGINT', close);
