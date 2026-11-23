import { createConnection, type Socket } from 'node:net';
import { WebSocketServer } from 'ws';

/** Local test-only WebSocket-to-Postgres bridge. Exercises Neon's actual wire
 * driver against real Postgres without a Neon account; never used by the SDK. */
export async function startNeonProxy(databaseUrl: string) {
  const target = new URL(databaseUrl);
  const server = new WebSocketServer({ host: '127.0.0.1', port: 0 });
  const sockets = new Set<Socket>();
  server.on('connection', ws => {
    const socket = createConnection({ host: target.hostname, port: Number(target.port || 5432) });
    sockets.add(socket);
    ws.on('message', data => socket.write(Array.isArray(data) ? Buffer.concat(data) : Buffer.from(data as ArrayBuffer)));
    socket.on('data', data => { if (ws.readyState === ws.OPEN) ws.send(data); });
    socket.on('error', () => ws.close());
    socket.on('close', () => { sockets.delete(socket); ws.close(); });
    ws.on('close', () => socket.destroy());
    ws.on('error', () => socket.destroy());
  });
  await new Promise<void>((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing proxy address.');
  return {
    address: `127.0.0.1:${address.port}`,
    async close() {
      for (const socket of sockets) socket.destroy();
      for (const ws of server.clients) ws.terminate();
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    },
  };
}
