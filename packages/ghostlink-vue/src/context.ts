import { computed, inject, onScopeDispose, shallowRef } from 'vue';
import type { App, InjectionKey, Plugin } from 'vue';
import type { Ghostlink } from 'ghostlink-core';
export const GhostlinkKey: InjectionKey<Ghostlink> = Symbol('Ghostlink');
export const GhostlinkPlugin: Plugin<[Ghostlink]> = {
  install(app: App, client: Ghostlink) {
    app.provide(GhostlinkKey, client);
    let release: (() => void) | undefined;
    // Plugin installation also runs during SSR. Activate only when the app root mounts.
    app.mixin({
      mounted() { if (this.$parent === null) release = client.attach(); },
      // Root replacement during HMR can unmount the component without app.unmount().
      beforeUnmount() { if (this.$parent === null) { release?.(); release = undefined; } },
    });
    app.onUnmount(() => { release?.(); });
  },
};
export function useGhostlink() {
  const client = inject(GhostlinkKey);
  if (!client) throw new Error('Install GhostlinkPlugin or wrap this component in GhostlinkProvider.');
  const state = shallowRef(client.getSnapshot());
  const unsubscribe = client.subscribe(() => { state.value = client.getSnapshot(); });
  onScopeDispose(unsubscribe);
  return { client, snapshot: computed(() => state.value) };
}
