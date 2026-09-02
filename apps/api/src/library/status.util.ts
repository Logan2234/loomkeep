import type { EntryStatus, MediaType, ProgressDto } from "@loomkeep/shared";
import { isAiringFinished } from "../catalog/airing-status.util";

// Re-exported under this module's original name — the logic itself now
// lives in catalog/airing-status.util.ts (see there for the rationale),
// shared with the gamification module's SEASON_COMPLETED/SERIES_COMPLETED
// verifiers so both agree on the same "has finished airing" answer.
export { isAiringFinished as normalizeAiringFinished };

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
