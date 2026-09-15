import { useQueryClient } from "@tanstack/svelte-query";
import { getAdminReportsPendingCount } from "./api/client";
import { keys } from "./api/keys";
import { createApiQuery } from "./api/query.svelte";
import { auth } from "./auth.svelte";
import { onRealtimeEvent } from "./realtime/socket";

/**
 * Live count of pending admin reports while an admin is signed in — shared by
 * every nav skin that shows the badge, and the admin overview page, so they
 * can never disagree. Pushed live by EventsGateway (see ReportService's
 * create()/resolve()) instead of the 20s poll this used to run.
 */
export function useReportsPendingCount() {
  const queryClient = useQueryClient();
  const query = createApiQuery(() => ({
    key: keys.admin.reportsPendingCount(),
    fetch: () => getAdminReportsPendingCount().then((r) => r.count),
    enabled: auth.isAdmin,
  }));

  $effect(() =>
    onRealtimeEvent("reports-count", () => {
      void queryClient.invalidateQueries({
        queryKey: keys.admin.reportsPendingCount(),
      });
    }),
  );

  return {
    get count() {
      return query.data ?? 0;
    },
  };
}
