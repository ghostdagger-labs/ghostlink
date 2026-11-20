import { createGhostlink, type AuthSession, type GhostlinkConfig, type GhostlinkSnapshot } from '@ghostdagger/ghostlink-core';
import { GhostlinkConnectButton as VueButton, GhostlinkModal as VueModal, useGhostlink as useVue } from '@ghostdagger/ghostlink-vue';
import { GhostlinkConnectButton as ReactButton, GhostlinkModal as ReactModal, useGhostlink as useReact } from '@ghostdagger/ghostlink-react';
import type { ComponentProps } from 'react';

// Compile against installed tarballs, not workspace source aliases. No runtime execution.
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Assert<T extends true> = T;
type DeepReadonly<T> = T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } : T;
type ReactButtonState = Parameters<NonNullable<ComponentProps<typeof ReactButton>['children']>>[0];
type ReactModalState = Parameters<NonNullable<ComponentProps<typeof ReactModal>['children']>>[0];
type VueButtonState = Parameters<NonNullable<InstanceType<typeof VueButton>['$slots']['default']>>[0];
type VueModalState = Parameters<NonNullable<InstanceType<typeof VueModal>['$slots']['content']>>[0];

// Also protect future fields: every reachable snapshot property must remain readonly.
export type SnapshotContract = [
  Assert<Equal<GhostlinkSnapshot, DeepReadonly<GhostlinkSnapshot>>>,
  Assert<Equal<ReturnType<ReturnType<typeof createGhostlink>['getSnapshot']>, GhostlinkSnapshot>>,
  Assert<Equal<ReturnType<typeof useReact>['snapshot'], GhostlinkSnapshot>>,
  Assert<Equal<ReturnType<typeof useVue>['snapshot']['value'], GhostlinkSnapshot>>,
  Assert<Equal<ReactButtonState['snapshot'], GhostlinkSnapshot>>,
  Assert<Equal<ReactModalState['snapshot'], GhostlinkSnapshot>>,
  Assert<Equal<VueButtonState['snapshot'], GhostlinkSnapshot>>,
  Assert<Equal<VueModalState['snapshot'], GhostlinkSnapshot>>,
];

function rejectWrites(snapshot: GhostlinkSnapshot) {
  // @ts-expect-error controller state cannot be assigned by consumers
  snapshot.busy = true;
  // @ts-expect-error readiness is controlled by the lifecycle
  snapshot.initialization = 'ready';
  if (snapshot.session) {
    // @ts-expect-error nested session identity is read-only
    snapshot.session.address = 'changed';
    // @ts-expect-error expiry is backend-owned
    snapshot.session.idleExpiresAt = 'changed';
  }
  // @ts-expect-error session replacement must go through client operations
  snapshot.session = null;
  if (snapshot.account) {
    // @ts-expect-error wallet account metadata is read-only
    snapshot.account.network = 'mainnet';
  }
  if (snapshot.challenge) {
    // @ts-expect-error a challenge must retain the exact server message
    snapshot.challenge.message = 'changed';
  }
  if (snapshot.error) {
    // @ts-expect-error operation error metadata is read-only
    snapshot.error.code = 'BUSY';
  }
  if (snapshot.initializationError) {
    // @ts-expect-error initialization error metadata is read-only
    snapshot.initializationError.message = 'changed';
  }
  if (snapshot.request) {
    // @ts-expect-error request review metadata is read-only
    snapshot.request.title = 'changed';
  }
  // @ts-expect-error discovered wallets cannot be appended to the snapshot
  snapshot.wallets.push(snapshot.wallets[0]!);
  // @ts-expect-error discovered wallets cannot be replaced by index
  snapshot.wallets[0] = snapshot.wallets[0]!;
  const wallet = snapshot.wallets[0]!;
  // @ts-expect-error wallet descriptors are read-only
  wallet.available = false;
  // @ts-expect-error nested capabilities are read-only
  wallet.capabilities.transfer = false;
  // @ts-expect-error capability arrays cannot be replaced
  wallet.capabilities.transactionFormats = [];
  // @ts-expect-error capability arrays cannot be mutated
  wallet.capabilities.transactionFormats.push('pskt-json');
  // @ts-expect-error capability array entries cannot be reassigned
  wallet.capabilities.transactionFormats[0] = 'pskt-json';
}

function frameworkConsumers() {
  const react = useReact();
  const vue = useVue();
  // @ts-expect-error React consumers receive read-only state
  react.snapshot.open = false;
  // @ts-expect-error Vue's ref cannot be replaced
  vue.snapshot.value = react.snapshot;
  // @ts-expect-error Vue's unwrapped snapshot is also read-only
  vue.snapshot.value.open = false;
  if (vue.snapshot.value.session) {
    // @ts-expect-error nested Vue session properties remain read-only
    vue.snapshot.value.session.expiresAt = 'changed';
  }
  // Existing commands remain the supported write API.
  react.client.open();
  void vue.client.setNetwork('testnet-10');
  return [react.snapshot.session?.address, vue.snapshot.value.session?.address];
}

function hostOwnedInputs(config: GhostlinkConfig, session: AuthSession, snapshot: GhostlinkSnapshot) {
  // Read-only output views must not make configuration or custom transport records immutable.
  config.network = 'testnet-10';
  config.app.name = 'Host application';
  session.idleExpiresAt = new Date().toISOString();
  const summary = { ...snapshot };
  summary.busy = false;
  const formats = [...snapshot.wallets[0]!.capabilities.transactionFormats];
  formats.push('pskt-json');
  const address: string | undefined = snapshot.session?.address;
  return { summary, formats, address };
}
void [rejectWrites, frameworkConsumers, hostOwnedInputs];
