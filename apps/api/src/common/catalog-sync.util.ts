export const CATALOG_SYNC_TTL_MS = 24 * 60 * 60 * 1000;

export function isCatalogFresh(lastSyncedAt: Date): boolean {
  return Date.now() - lastSyncedAt.getTime() < CATALOG_SYNC_TTL_MS;
}

/** What one run of a background catalogue refresh did. */
export interface RefreshOutcome {
  refreshed: number;
  /** Items the provider failed on, set aside until their failure ages out. */
  failed: number;
}

/**
 * The refresh jobs take the stalest items first: one whose provider keeps
 * failing (a title removed from TMDB, a merged Open Library work) used to
 * stay at the head of the queue for good, and enough of them starved every
 * other item. A failed attempt is stamped on `syncFailedAt` instead, which
 * keeps the item out of the job until `since`, without touching the
 * `lastSyncedAt` the admin cache page reports.
 */
export function notFailedSince(since: Date) {
  return { OR: [{ syncFailedAt: null }, { syncFailedAt: { lt: since } }] };
}

/** The JobRun summary of a refresh, failures included. */
export function summarizeRefresh(
  noun: string,
): (outcome: RefreshOutcome) => string {
  return ({ refreshed, failed }) => {
    if (refreshed === 0 && failed === 0) return "Nothing to refresh";
    const done = `${refreshed}/${refreshed + failed} ${noun}(s) refreshed`;
    return failed > 0 ? `${done}, ${failed} failed` : done;
  };
}

/**
 * Fails the run when every attempt failed, so the admin "Jobs" page and
 * Healthchecks show a provider outage instead of a green "nothing to do".
 * The failed items are stamped before this throws.
 */
export function assertSomeRefreshed(
  outcome: RefreshOutcome,
  noun: string,
): RefreshOutcome {
  if (outcome.refreshed === 0 && outcome.failed > 0) {
    throw new Error(`Every ${noun} refresh failed (${outcome.failed})`);
  }

  return outcome;
}
