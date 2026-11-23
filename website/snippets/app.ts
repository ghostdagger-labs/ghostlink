import { createGhostlink } from '@ghostdagger/ghostlink-core';

const client = createGhostlink({
  app: { name: 'My dApp', url: 'https://app.example' },
  network: 'mainnet',
  auth: { baseUrl: '/auth/ghostlink' },
});

// Call from your own sign-in button; configure the backend first.
export async function signIn() {
  const release = client.attach();
  try {
    await client.restoreSession();
    await client.connect('kasware');
    return await client.authenticate(); // Backend-verified session.
  } finally {
    release(); // Stop this attachment; keep the backend session.
  }
}
