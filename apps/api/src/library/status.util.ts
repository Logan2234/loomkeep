import type { ProgressDto } from "@loomkeep/shared/contracts";
import type { EntryStatus, MediaType } from "@loomkeep/shared/enums";
import { isAiringFinished } from "../catalog/airing-status.util";
import type { PrismaService } from "../prisma/prisma.service";

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
 * - A rewatch puts a seen title back in the queue: WATCHING for a series,
 *   PLANNED for a movie.
 */
export function deriveStatus(
  type: MediaType,
  progress: ProgressDto | null,
  airingFinished: boolean,
  storedStatus: EntryStatus,
  rewatching = false,
): EntryStatus {
  if (storedStatus === "DROPPED") {
    return storedStatus;
  }

  if (rewatching) {
    return type === "MOVIE" ? "PLANNED" : "WATCHING";
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

/**
 * `deriveStatus` from an entry's materialized counts (no rewatch): what the
 * library list shows. A series' stored status is PLANNED or DROPPED whatever
 * was watched, so a query asking for "in progress" filters on this, after a
 * `watchedEpisodes > 0`, not-DROPPED prefilter in SQL.
 */
export function materializedStatus(entry: {
  status: string;
  watchedEpisodes: number;
  mediaItem: { type: string; status: string | null; episodeCount: number };
}): EntryStatus {
  const { mediaItem } = entry;
  return deriveStatus(
    mediaItem.type as MediaType,
    mediaItem.episodeCount > 0
      ? {
          watchedEpisodes: entry.watchedEpisodes,
          totalEpisodes: mediaItem.episodeCount,
          nextEpisode: null,
        }
      : null,
    isAiringFinished(mediaItem.status),
    entry.status as EntryStatus,
  );
}

/**
 * Of these works, the ones with a regular episode out and not yet seen by
 * the user (an undated one counts as out, as AniList's generated episodes
 * do). The materialized count also holds announced episodes, so a viewer
 * caught up and waiting reads as "in progress" without this.
 */
export async function withEpisodeLeftToWatch(
  prisma: PrismaService,
  userId: string,
  mediaItemIds: string[],
  now: Date,
): Promise<Set<string>> {
  if (mediaItemIds.length === 0) return new Set();

  const seasons = await prisma.season.findMany({
    where: {
      mediaItemId: { in: mediaItemIds },
      number: { gt: 0 },
      episodes: {
        some: {
          OR: [{ airDate: null }, { airDate: { lte: now } }],
          watches: { none: { userId } },
        },
      },
    },
    select: { mediaItemId: true },
  });
  return new Set(seasons.map((s) => s.mediaItemId));
}
