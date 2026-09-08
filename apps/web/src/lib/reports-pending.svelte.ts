import { getAdminReportsPendingCount } from "./api/client";
import { keys } from "./api/keys";
import { createApiQuery } from "./api/query.svelte";
import { auth } from "./auth.svelte";

/**
 * Live count of pending admin reports, polled every 20s while an admin is
 * signed in — shared by every nav skin that shows the badge, and the admin
 * overview page, so they can never disagree.
 */
export function useReportsPendingCount() {
  const query = createApiQuery(() => ({
    key: keys.admin.reportsPendingCount(),
    fetch: () => getAdminReportsPendingCount().then((r) => r.count),
    refetchInterval: 20_000,
    enabled: auth.isAdmin,
  }));

  return {
    get count() {
      return query.data ?? 0;
    },
  };
}
