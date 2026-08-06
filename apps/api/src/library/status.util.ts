import type { EntryStatus, MediaType, ProgressDto } from "@loomkeep/shared";

/**
 * Source airing-status strings that mean "the show is over, no more episodes
 * are coming" — TMDB uses "Ended"/"Canceled", AniList "FINISHED"/"CANCELLED".
 * Anything else (Returning Series, RELEASING, NOT_YET_RELEASED, HIATUS…) is
 * treated as still airing.
 */
const FINISHED_AIRING_STATUSES = new Set([
  "ENDED",
  "CANCELED",
  "CANCELLED",
  "FINISHED",
]);

/** Normalise a free-form source airing status to "has finished airing". */
export function normalizeAiringFinished(status: string | null): boolean {
  if (!status) return false;
  return FINISHED_AIRING_STATUSES.has(status.toUpperCase());
}

/**
 * Effective library status. DROPPED is a manual override that wins over
 * everything; every other status is derived from watch progress (+ airing
 * status for series/anime), so it can never drift from the actual watch data.
 *
 * - Movies have no episode progress: their stored status is the source of truth
 *   (COMPLETED = seen, anything else = À voir). No WATCHING/UP_TO_DATE.
 * - Series/anime: 0 watched → PLANNED, partial → WATCHING, all released watched
 *   → COMPLETED if the show finished airing, else UP_TO_DATE (caught up).
 */
export function deriveStatus(
  type: MediaType,
  progress: ProgressDto | null,
  airingFinished: boolean,
  storedStatus: EntryStatus,
): EntryStatus {
  if (storedStatus === "DROPPED") {
    return storedStatus;
  }

  if (type === "MOVIE") {
    return storedStatus === "COMPLETED" ? "COMPLETED" : "PLANNED";
  }

  // Series / anime — driven by episode progress.
  if (!progress || progress.totalEpisodes === 0) {
    return "PLANNED";
  }

  const { watchedEpisodes, totalEpisodes } = progress;

  if (watchedEpisodes === 0) {
    return "PLANNED";
  }

  if (watchedEpisodes >= totalEpisodes) {
    return airingFinished ? "COMPLETED" : "UP_TO_DATE";
  }

  return "WATCHING";
}
