import Provider from './GhostlinkProvider.vue';
import ConnectButton from './GhostlinkConnectButton.vue';
import Modal from './GhostlinkModal.vue';

export { GhostlinkPlugin, useGhostlink } from './context';
/** Component-scoped alternative to GhostlinkPlugin. Borrows a stable client and owns its mounted lifecycle; SSR is passive and unmount does not sign out or destroy the client. */
export const GhostlinkProvider: typeof Provider = Provider;
/** Open wallet login or account details. Disabled while initialization is idle/restoring; the provider owns initialization. The default slot receives a readonly snapshot and open action. Theme defaults to dark, label to Connect wallet; variables scopes --ghostlink-* CSS properties. */
export const GhostlinkConnectButton: typeof ConnectButton = ConnectButton;
/** Render one modal host per client. The content slot can replace the body; custom content owns accessible review controls and client actions. Theme defaults to dark; variables scopes --ghostlink-* CSS properties. */
export const GhostlinkModal: typeof Modal = Modal;
