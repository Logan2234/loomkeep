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

/** How far along each status is: an import only ever moves an entry forward. */
const STATUS_RANK: Record<EntryStatus, number> = {
  PLANNED: 0,
  WATCHING: 1,
  DROPPED: 1,
  UP_TO_DATE: 2,
  COMPLETED: 2,
};

/**
 * The status to keep when an import meets an entry the user already has: the
 * incoming one only when it is further along, so a watchlist row never sends a
 * finished film back to "planned".
 */
export function furthestStatus(
  existing: EntryStatus | null,
  incoming: EntryStatus,
): EntryStatus {
  if (existing === null) return incoming;
  return STATUS_RANK[incoming] > STATUS_RANK[existing] ? incoming : existing;
}
