import { env } from "$env/dynamic/public";
import { EVENTS, UnleashClient } from "unleash-proxy-client";

/**
 * Generic, reactive live feature flags — the default way to gate a new
 * feature on the web. Call `liveFlags.isEnabled("MY_FLAG")` from a
 * $derived/markup context; it recomputes whenever Unleash pushes an
 * update, no per-flag wiring needed in this file.
 *
 * Always returns false when this deployment doesn't run Unleash
 * (`PUBLIC_UNLEASH_FRONTEND_URL` unset) or before the flag exists in
 * Unleash — the Frontend API only reports *enabled* flags, so "not created
 * yet" and "explicitly off" are indistinguishable here. That's fine for a
 * kill-switch-style flag (off by default, like `MAINTENANCE_<DOMAIN>`), but
 * a flag that should default to *on* until someone explicitly disables it
 * can't use this path — relay it through `GET /api/config` instead (see
 * `isSocialEnabled`/`isRegistrationEnabled` for that pattern), since only
 * the API's `FeatureFlagsService` knows a real fallback.
 */
class LiveFlags {
  #client?: UnleashClient;
  #version = $state(0);

  /** Called once from bootstrap.svelte.ts. No-op if Unleash isn't configured. */
  start(): void {
    const url = env.PUBLIC_UNLEASH_FRONTEND_URL;
    const clientKey = env.PUBLIC_UNLEASH_FRONTEND_TOKEN;
    if (!url || !clientKey) return;

    this.#client = new UnleashClient({
      url,
      clientKey,
      appName: "loomkeep-web",
    });
    this.#client.on(EVENTS.UPDATE, () => this.#version++);
    void this.#client.start();
  }

  isEnabled(name: string, fallback: boolean = false): boolean {
    void this.#version; // reactivity dependency — bumped on every Unleash update
    return this.#client?.isEnabled(name) ?? fallback;
  }
}

export const liveFlags = new LiveFlags();
