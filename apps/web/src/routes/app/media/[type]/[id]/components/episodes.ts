import type {
  MediaDetailEpisodeDto,
  MediaDetailSeasonDto,
} from "@loomkeep/shared";

/** Aired by `now` — an unknown date counts as aired, like the API does. */
export function isAired(
  episode: Pick<MediaDetailEpisodeDto, "airDate">,
  now: Date,
): boolean {
  return !episode.airDate || new Date(episode.airDate) <= now;
}

/**
 * The season to open on arrival: the one being watched — holding the first
 * aired, unwatched episode of the regular run — once something has been
 * watched. None for a show not started yet, or one watched up to date.
 */
export function defaultSeasonNumber(
  seasons: MediaDetailSeasonDto[],
  now: Date,
): number | null {
  const regular = seasons.filter((s) => s.number !== 0);
  const started = seasons.some((s) => s.episodes.some((e) => e.watchCount));
  if (!started) return null;

  const current = regular.find((s) =>
    s.episodes.some((e) => e.watchCount === 0 && isAired(e, now)),
  );
  return current?.number ?? null;
}

/** Watched / aired counts over the regular run (specials left out). */
export function runProgress(
  seasons: MediaDetailSeasonDto[],
  now: Date,
): { watched: number; aired: number } {
  const episodes = seasons
    .filter((s) => s.number !== 0)
    .flatMap((s) => s.episodes);
  return {
    watched: episodes.filter((e) => e.watchCount > 0).length,
    aired: episodes.filter((e) => isAired(e, now)).length,
  };
}

/**
 * How many regular episodes *before* this one are still unwatched — drives
 * the catch-up prompt. Specials are not part of the linear run.
 */
export function unwatchedGapCount(
  seasons: MediaDetailSeasonDto[],
  seasonNumber: number,
  episodeNumber: number,
): number {
  if (seasonNumber === 0) return 0;
  let count = 0;

  for (const s of seasons) {
    if (s.number === 0) continue;

    for (const ep of s.episodes) {
      const before =
        s.number < seasonNumber ||
        (s.number === seasonNumber && ep.number < episodeNumber);
      if (before && ep.watchCount === 0) count++;
    }
  }

  return count;
}

const TMDB_STILL = /(image\.tmdb\.org\/t\/p\/)w\d+\//;

/** The side panel's size of a TMDB still; other hosts' images as they are. */
export function largeStill(url: string): string {
  return url.replace(TMDB_STILL, "$1w780/");
}

/** YouTube's own preview frame for a video. */
export function videoThumbnail(key: string): string {
  return `https://i.ytimg.com/vi/${encodeURIComponent(key)}/hqdefault.jpg`;
}
