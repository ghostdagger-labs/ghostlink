import { createGhostlink } from '@ghostdagger/ghostlink-core';

const client = createGhostlink({
  app: { name: 'My dApp', url: 'https://app.example' },
  network: 'mainnet',
  auth: { baseUrl: '/auth/ghostlink' },
});

// In a framework app, its provider owns initialization.
// Headless consumers acquire and later release browser activity:
const release = client.attach();

// Opens wallet selection when a UI host is mounted.
client.open();
// Release this headless owner when finished.
// release();
