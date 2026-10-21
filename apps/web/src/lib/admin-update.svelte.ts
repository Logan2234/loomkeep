import { getAdminUpdateStatus } from "./api/client";
import { keys } from "./api/keys";
import { createApiQuery } from "./api/query.svelte";
import { auth } from "./auth.svelte";

/**
 * Whether a newer Loomkeep version is published, for the dot every nav skin
 * puts on Admin › Services. Shares Admin › Services' own query.
 */
export function useAdminUpdateAvailable() {
  const query = createApiQuery(() => ({
    key: keys.admin.update(),
    fetch: getAdminUpdateStatus,
    enabled: auth.isAdmin,
  }));

  return {
    get available() {
      return !!query.data?.enabled && !!query.data.updateAvailable;
    },
  };
}
