import { DORMANT_AFTER_DAYS } from "@tracklore/shared";
import type {
  MediaType,
  VideoTypeSplitDto,
  WatchStaleness,
} from "@tracklore/shared";

/**
 * Fallback runtime (minutes) for a title with no captured `runtimeMin` yet —
 * rough per-type averages so watch time stays plausible until the real value
 * lands. Mirrors the pre-P4-social stats aggregation.
 */
const DEFAULT_RUNTIME_MIN: Record<MediaType, number> = {
  MOVIE: 110,
  SERIES: 42,
  ANIME: 24,
};

export function runtimeFor(type: MediaType, runtimeMin: number | null): number {
  return runtimeMin && runtimeMin > 0 ? runtimeMin : DEFAULT_RUNTIME_MIN[type];
}

export interface TypeSplitInput {
  type: MediaType;
  minutes: number;
}

/** Groups minutes by media type — the movie/series/anime split. */
export function computeTypeSplit(rows: TypeSplitInput[]): VideoTypeSplitDto[] {
  const byType = new Map<MediaType, { count: number; minutes: number }>();

  for (const r of rows) {
    const cur = byType.get(r.type) ?? { count: 0, minutes: 0 };
    cur.count++;
    cur.minutes += r.minutes;
    byType.set(r.type, cur);
  }

  return [...byType.entries()]
    .map(([type, v]) => ({ type, ...v }))
    .sort((a, b) => b.minutes - a.minutes);
}

/** Most watch events falling within any rolling 24h window. */
export function computeLongestBinge(watchedAt: Date[]): number {
  const times = watchedAt.map((d) => d.getTime()).sort((a, b) => a - b);
  const WINDOW_MS = 24 * 60 * 60 * 1000;
  let best = 0;
  let start = 0;

  for (let end = 0; end < times.length; end++) {
    while (times[end] - times[start] >= WINDOW_MS) start++;
    best = Math.max(best, end - start + 1);
  }

  return best;
}

export interface SeasonProgressInput {
  /** Episodes aired so far (see the "à jour" convention in computeProgress). */
  totalEpisodes: number;
  watchedEpisodes: number;
}

/** A season counts once every episode aired so far has been watched. */
export function countCompletedSeasons(seasons: SeasonProgressInput[]): number {
  return seasons.filter(
    (s) => s.totalEpisodes > 0 && s.watchedEpisodes >= s.totalEpisodes,
  ).length;
}

/** Last-touched timestamp per media item, from raw episode watches. */
export function lastWatchedPerMediaItem(
  watches: { mediaItemId: string; watchedAt: Date }[],
): Map<string, Date> {
  const result = new Map<string, Date>();

  for (const w of watches) {
    const cur = result.get(w.mediaItemId);
    if (!cur || w.watchedAt > cur) result.set(w.mediaItemId, w.watchedAt);
  }

  return result;
}

/** A WATCHING series/anime untouched this many days is a "ghost". */
export const GHOST_AFTER_DAYS = 180;

// Mutually exclusive with the shared `isDormant` window: 30-180 days is
// "paused", 180+ is "ghost" — `lastTouched` must already be known (a series
// never watched at all is neither).
export function classifyStaleness(
  lastTouched: Date,
  now: Date = new Date(),
): WatchStaleness | null {
  const days = (now.getTime() - lastTouched.getTime()) / (24 * 60 * 60 * 1000);
  if (days >= GHOST_AFTER_DAYS) return "GHOST";
  if (days >= DORMANT_AFTER_DAYS) return "PAUSED";
  return null;
}
