import { computed, inject, onScopeDispose, shallowRef } from 'vue';
import type { App, InjectionKey, Plugin } from 'vue';
import type { Ghostlink } from 'ghostlink-core';
export const GhostlinkKey: InjectionKey<Ghostlink> = Symbol('Ghostlink');
export const GhostlinkPlugin: Plugin<[Ghostlink]> = { install(app: App, client: Ghostlink) { app.provide(GhostlinkKey, client); } };
export function useGhostlink() {
  const client = inject(GhostlinkKey);
  if (!client) throw new Error('Install GhostlinkPlugin or wrap this component in GhostlinkProvider.');
  const state = shallowRef(client.getSnapshot());
  const unsubscribe = client.subscribe(() => { state.value = client.getSnapshot(); });
  onScopeDispose(unsubscribe);
  return { client, snapshot: computed(() => state.value) };
}
