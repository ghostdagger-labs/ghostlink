import { computed, inject, onScopeDispose, shallowRef } from 'vue';
import type { App, InjectionKey, Plugin } from 'vue';
import type { Ghostlink } from 'ghostlink-core';
export const GhostlinkKey: InjectionKey<Ghostlink> = Symbol('Ghostlink');
/** Install once with app.use(GhostlinkPlugin, client). Borrows a stable client, initializes on root mount, and releases on unmount without destroying it or signing out. Passive during SSR; create a client per request. */
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
/** Read the injected client and readonly snapshot ref; nested snapshot data is readonly too. Use snapshot.value in script and wait for initialization === 'ready' before using identity. Cleans up with the component scope; requires GhostlinkPlugin or GhostlinkProvider. */
export function useGhostlink() {
  const client = inject(GhostlinkKey);
  if (!client) throw new Error('Install GhostlinkPlugin or wrap this component in GhostlinkProvider.');
  const state = shallowRef(client.getSnapshot());
  const unsubscribe = client.subscribe(() => { state.value = client.getSnapshot(); });
  onScopeDispose(unsubscribe);
  return { client, snapshot: computed(() => state.value) };
}
