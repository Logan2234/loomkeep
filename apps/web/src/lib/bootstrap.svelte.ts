import { initAuth, initConfig } from "./api/client";
import { liveFlags } from "./feature-flags-live.svelte";

/**
 * One-shot client bootstrap: restore the session from localStorage and load
 * the public runtime config (social/registration flags).
 *
 * This lives in its own module rather than the root layout because three
 * layouts need `ready`: `/app` and `(auth)` gate their whole render on it (so
 * no protected screen or auth form flashes before we know who the user is),
 * while the public landing page renders immediately and only swaps its CTA
 * once it resolves.
 */
class Bootstrap {
  ready = $state(false);
  #started = false;

  /** Idempotent — the root layout calls it from an effect on every navigation. */
  start(): void {
    if (this.#started) return;
    this.#started = true;

    liveFlags.start();
    void Promise.all([initAuth(), initConfig()]).finally(() => {
      this.ready = true;
    });
  }
}

export const bootstrap = new Bootstrap();
