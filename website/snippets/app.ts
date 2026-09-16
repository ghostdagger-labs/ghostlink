import { createGhostlink } from 'ghostlink-core';

const client = createGhostlink({
  app: { name: 'My dApp', url: 'https://app.example' },
  network: 'mainnet',
  auth: { baseUrl: '/auth/ghostlink' },
});

// Opens wallet selection; the UI guides login.
client.open();
// Dispose the controller when your app unmounts.
// client.destroy();
