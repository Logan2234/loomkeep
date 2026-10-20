import type { EntryStatus } from "@loomkeep/shared";
import { toSummary } from "../../../catalog/providers/anilist.mapper";
import type {
  AnilistFuzzyDate,
  AnilistListEntry,
} from "../../../catalog/providers/anilist.provider";
import type { ImportShow } from "../../media-import-model";
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
export function buildAnilistShows(entries: AnilistListEntry[]): ImportShow[] {
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
    });
  }

  return shows;
}

/** AniList's fuzzy date, only when it's a whole, real day. */
function toDate(date: AnilistFuzzyDate | null): Date | null {
  if (!date?.year || !date.month || !date.day) return null;
  const parsed = new Date(Date.UTC(date.year, date.month - 1, date.day));
  return parsed.getUTCMonth() === date.month - 1 ? parsed : null;
}
