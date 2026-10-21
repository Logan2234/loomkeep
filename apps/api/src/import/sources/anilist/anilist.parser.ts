import type { EntryStatus } from "@loomkeep/shared";
import { toSummary } from "../../../catalog/providers/anilist.mapper";
import type {
  AnilistFuzzyDate,
  AnilistListEntry,
  AnilistUserList,
} from "../../../catalog/providers/anilist.provider";
import type { ImportList, ImportShow } from "../../media-import-model";
import { toMatch } from "../media/media-match-resolver";

const MAX_WATCHED_EPISODES_PER_ENTRY = 10_000;

// Paused and rewatched titles stay in progress, as MyAnimeList's On-Hold does.
const STATUS: Record<string, EntryStatus> = {
  CURRENT: "WATCHING",
  REPEATING: "WATCHING",
  PAUSED: "WATCHING",
  COMPLETED: "COMPLETED",
  DROPPED: "DROPPED",
  PLANNING: "PLANNED",
};

/**
 * An AniList user's anime list as import shows. Its ids are the catalogue's
 * own (AniList is Loomkeep's anime provider), so each show carries its match.
 */
export function buildAnilistShows(
  entries: AnilistListEntry[],
  favouriteIds: ReadonlySet<number> = new Set(),
): ImportShow[] {
  const seen = new Set<number>();
  const shows: ImportShow[] = [];

  for (const entry of entries) {
    const status = STATUS[entry.status];
    if (!status || seen.has(entry.media.id)) continue;
    seen.add(entry.media.id);

    const summary = toSummary(entry.media);
    const watched = Math.min(
      Math.max(0, Math.trunc(entry.progress ?? 0)),
      MAX_WATCHED_EPISODES_PER_ENTRY,
    );
    shows.push({
      title: summary.title,
      externalIds: { anilist: String(entry.media.id) },
      match: toMatch(summary),
      episodes: Array.from({ length: watched }, (_, index) => ({
        season: 1,
        episode: index + 1,
        sourceEpisodeId: `anilist:${entry.media.id}:${index + 1}`,
        watchedAt: null,
        totalWatches: 1,
      })),
      // Half points, as Loomkeep rates; 0 is AniList's "no score".
      rating: entry.score ? Math.round(entry.score * 2) / 2 : null,
      status,
      startedAt: status === "PLANNED" ? null : toDate(entry.startedAt),
      finishedAt: status === "COMPLETED" ? toDate(entry.completedAt) : null,
      notes: entry.notes?.trim() || null,
      favorite: favouriteIds.has(entry.media.id),
      addedAt: entry.createdAt ? new Date(entry.createdAt * 1000) : null,
    });
  }

  return shows;
}

/**
 * The user's custom lists. Every entry also sits in a status list, so each
 * item carries the same match its show does and lands on one plan item.
 */
export function buildAnilistLists(
  customLists: AnilistUserList["customLists"],
): ImportList[] {
  return customLists
    .filter((list) => list.entries.length > 0)
    .map((list) => ({
      name: list.name,
      description: null,
      items: list.entries.map((entry) => {
        const summary = toSummary(entry.media);
        return {
          title: summary.title,
          year: summary.year,
          externalIds: { anilist: String(entry.media.id) },
          type: "SERIES" as const,
          match: toMatch(summary),
        };
      }),
    }));
}

/** AniList's fuzzy date, only when it's a whole, real day. */
function toDate(date: AnilistFuzzyDate | null): Date | null {
  if (!date?.year || !date.month || !date.day) return null;
  const parsed = new Date(Date.UTC(date.year, date.month - 1, date.day));
  return parsed.getUTCMonth() === date.month - 1 ? parsed : null;
}
