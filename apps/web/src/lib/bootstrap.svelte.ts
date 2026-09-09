import { initAuth, initConfig } from "./api/client";
import { liveFlags } from "./feature-flags-live.svelte";

/**
 * One-shot client bootstrap: restore the session from HttpOnly cookies and load
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
  /**
   * The API never answered, so we don't know whether there is a session.
   * `/app` shows a reconnect screen on this rather than bouncing to /login,
   * which is what used to happen on any startup failure — a dropped mobile
   * connection looked exactly like an expired session.
   */
  apiUnreachable = $state(false);
  #started = false;

  /** Idempotent — the root layout calls it from an effect on every navigation. */
  start(): void {
    if (this.#started) return;
    this.#started = true;

    void liveFlags.start();
    void Promise.all([initAuth(), initConfig()])
      .then(([sessionKnown]) => {
        this.apiUnreachable = !sessionKnown;
      })
      .finally(() => {
        this.ready = true;
      });
  }

  /** Retry from the reconnect screen. */
  retry(): void {
    this.#started = false;
    this.ready = false;
    this.apiUnreachable = false;
    this.start();
  }
}

export const bootstrap = new Bootstrap();
