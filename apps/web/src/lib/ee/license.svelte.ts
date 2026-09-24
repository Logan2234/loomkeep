import { keys } from "$lib/api/keys";
import { createApiQuery } from "$lib/api/query.svelte";
import { auth } from "$lib/auth.svelte";
import { getEeStatus } from "./api";

/**
 * The lock of an ee/ feature (LICENSE-EE): premium-locked like any premium
 * screen, and also on an instance that has no license for it. Call it while
 * a component initializes; `locked` is reactive.
 */
export function useEeLock() {
  const status = createApiQuery(() => ({
    key: keys.ee.status(),
    fetch: getEeStatus,
  }));

  return {
    get locked(): boolean {
      return auth.isPremiumLocked || status.data?.active === false;
    },
  };
}
