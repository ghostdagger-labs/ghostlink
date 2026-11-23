import { createServer } from 'node:http';
import {
  createGhostlinkServer, createSqliteStorage, createNodeHandler,
} from '@ghostdagger/ghostlink-server';

const storage = createSqliteStorage('./data/auth.sqlite');
const auth = createGhostlinkServer({
  origin: 'https://app.example',
  loginUri: 'https://app.example/login',
  networks: ['mainnet'],
  storage,
});

// Proxy /auth/ghostlink/* from your HTTPS app, preserving Host.
createServer(createNodeHandler(auth)).listen(3000, '127.0.0.1');
// In protected Web handlers: await auth.getSession(request).
// Close storage during graceful server shutdown.
