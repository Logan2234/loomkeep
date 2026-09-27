import type { MediaType } from "./enums";

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

/**
 * One watched episode's length: its own runtime when the source gave one,
 * else the title's average, else the per-type default — the single rule every
 * watch-time figure (stats, profile, advanced stats, what's left to watch) must share, or the same
 * viewing would add up differently from one screen to the next.
 */
export function episodeRuntimeFor(
  type: MediaType,
  episodeRuntimeMin: number | null,
  itemRuntimeMin: number | null,
): number {
  return episodeRuntimeMin && episodeRuntimeMin > 0
    ? episodeRuntimeMin
    : runtimeFor(type, itemRuntimeMin);
}

/** Whether a length came from the source rather than the per-type default. */
export function isRuntimeKnown(
  episodeRuntimeMin: number | null,
  itemRuntimeMin: number | null,
): boolean {
  return (
    (episodeRuntimeMin !== null && episodeRuntimeMin > 0) ||
    (itemRuntimeMin !== null && itemRuntimeMin > 0)
  );
}
