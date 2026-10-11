import type { EntryStatus } from "@loomkeep/shared";

/** Map a series' watched/total regular episodes to a library entry status. */
export function entryStatusFromProgress(
  watched: number,
  total: number,
): EntryStatus {
  if (watched === 0) return "PLANNED";
  if (total > 0 && watched >= total) return "COMPLETED";
  return "WATCHING";
}
