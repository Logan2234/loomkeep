/**
 * Source airing-status strings that mean "the show is over, no more episodes
 * are coming" — TMDB uses "Ended"/"Canceled", AniList "FINISHED"/"CANCELLED".
 * Anything else (Returning Series, RELEASING, NOT_YET_RELEASED, HIATUS…), and
 * any unknown/absent value, is treated as still airing — fail-safe, since
 * this also feeds the gamification SEASON_COMPLETED/SERIES_COMPLETED XP
 * verifiers, where a false "finished" would credit XP for a season that
 * isn't actually done.
 *
 * Lives in `catalog/` (rather than `library/`, where it originated) because
 * it's fundamentally about interpreting `MediaItem.status` — a catalog
 * concept — and both `library` and `gamification` need to agree on the same
 * answer without either depending on the other (library already depends on
 * catalog; gamification doing the same creates no cycle).
 */
const FINISHED_AIRING_STATUSES = new Set([
  "ENDED",
  "CANCELED",
  "CANCELLED",
  "FINISHED",
]);

/** Normalise a free-form source airing status to "has finished airing". */
export function isAiringFinished(status: string | null | undefined): boolean {
  if (!status) return false;
  return FINISHED_AIRING_STATUSES.has(status.toUpperCase());
}
