import {
  GhostlinkConnectButton, GhostlinkModal,
  useGhostlink,
} from 'ghostlink-react';

// Render inside your configured GhostlinkProvider.
export function WalletLogin() {
  const { snapshot } = useGhostlink();
  return <>
    <GhostlinkConnectButton />
    <GhostlinkModal />
    {snapshot.session && <p>Signed in</p>}
  </>;
}
