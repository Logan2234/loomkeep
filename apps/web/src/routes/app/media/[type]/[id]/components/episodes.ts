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

const SLICE_SIZE = 100;

/** One page of the episode list: a season, or a slice of a very long one. */
export interface EpisodeTab {
  key: string;
  seasonNumber: number;
  /** Episode numbers of a slice; null for a whole season. */
  range: { from: number; to: number } | null;
  episodes: MediaDetailEpisodeDto[];
}

/**
 * One tab per season, specials last. Only a show with a single regular season
 * over 100 episodes (a long-running anime) is cut into slices of 100: with
 * several seasons each keeps its one tab, however long.
 */
export function episodeTabs(seasons: MediaDetailSeasonDto[]): EpisodeTab[] {
  const withEpisodes = seasons.filter((s) => s.episodes.length > 0);
  const regular = withEpisodes
    .filter((s) => s.number !== 0)
    .sort((a, b) => a.number - b.number);
  const specials = withEpisodes.filter((s) => s.number === 0);
  const whole = (season: MediaDetailSeasonDto): EpisodeTab => ({
    key: `s${season.number}`,
    seasonNumber: season.number,
    range: null,
    episodes: season.episodes,
  });

  if (regular.length !== 1 || regular[0].episodes.length <= SLICE_SIZE) {
    return [...regular, ...specials].map(whole);
  }

  const season = regular[0];
  const slices = new Map<number, MediaDetailEpisodeDto[]>();

  for (const episode of season.episodes) {
    const slice = Math.max(0, Math.floor((episode.number - 1) / SLICE_SIZE));
    slices.set(slice, [...(slices.get(slice) ?? []), episode]);
  }

  const cut = [...slices.entries()]
    .sort(([a], [b]) => a - b)
    .map(([slice, episodes]) => ({
      key: `s${season.number}-${slice}`,
      seasonNumber: season.number,
      range: {
        from: slice * SLICE_SIZE + 1,
        to: Math.max(...episodes.map((e) => e.number)),
      },
      episodes,
    }));
  return [...cut, ...specials.map(whole)];
}

export function tabKeyOf(
  tabs: EpisodeTab[],
  seasonNumber: number,
  episodeNumber: number,
): string | null {
  const tab = tabs.find(
    (t) =>
      t.seasonNumber === seasonNumber &&
      t.episodes.some((e) => e.number === episodeNumber),
  );
  return tab?.key ?? null;
}

type RunEpisode = { seasonNumber: number; episode: MediaDetailEpisodeDto };

function firstInRun(
  seasons: MediaDetailSeasonDto[],
  matches: (episode: MediaDetailEpisodeDto) => boolean,
): RunEpisode | null {
  for (const season of [...seasons]
    .filter((s) => s.number !== 0)
    .sort((a, b) => a.number - b.number)) {
    const episode = season.episodes.find(matches);
    if (episode) return { seasonNumber: season.number, episode };
  }

  return null;
}

/** The first aired, unwatched episode of the regular run. */
export const nextUpEpisode = (seasons: MediaDetailSeasonDto[], now: Date) =>
  firstInRun(seasons, (e) => e.watchCount === 0 && isAired(e, now));

/** The first unwatched episode still to air. */
export const announcedEpisode = (seasons: MediaDetailSeasonDto[], now: Date) =>
  firstInRun(seasons, (e) => e.watchCount === 0 && !isAired(e, now));

/**
 * The tab to open on arrival: where the next episode is; else, up to date on a
 * tracked show, the last one of the regular run; else the first.
 */
export function arrivalTabKey(
  tabs: EpisodeTab[],
  seasons: MediaDetailSeasonDto[],
  tracked: boolean,
  now: Date,
): string | null {
  const next = nextUpEpisode(seasons, now);

  if (next) {
    return tabKeyOf(tabs, next.seasonNumber, next.episode.number);
  }

  const regular = tabs.filter((t) => t.seasonNumber !== 0);
  return (tracked ? regular.at(-1) : undefined)?.key ?? tabs[0]?.key ?? null;
}

/** Episode ids between two rows of a list, ends included, unaired ones left out. */
export function selectionRange(
  episodes: MediaDetailEpisodeDto[],
  fromId: string,
  toId: string,
  now: Date,
): string[] {
  const from = episodes.findIndex((e) => e.id === fromId);
  const to = episodes.findIndex((e) => e.id === toId);
  if (from < 0 || to < 0) return [];
  return episodes
    .slice(Math.min(from, to), Math.max(from, to) + 1)
    .filter((e) => isAired(e, now))
    .flatMap((e) => (e.id ? [e.id] : []));
}

/** Which episodes of a selection each bulk action would really touch. */
export function selectionActions(
  episodes: MediaDetailEpisodeDto[],
  now: Date,
): { watch: string[]; rewatch: string[]; unwatch: string[] } {
  const ids = (matches: (e: MediaDetailEpisodeDto) => boolean) =>
    episodes.filter(matches).flatMap((e) => (e.id ? [e.id] : []));
  const watched = ids((e) => e.watchCount > 0);
  return {
    watch: ids((e) => e.watchCount === 0 && isAired(e, now)),
    rewatch: watched,
    unwatch: watched,
  };
}

/** What a selection spans: its ends within one tab, or how many tabs. */
export function selectionSpan(
  tabs: EpisodeTab[],
  selected: ReadonlySet<string>,
  now: Date,
):
  | {
      tabs: 1;
      seasonNumber: number;
      first: number;
      last: number;
      /** Nothing selectable left out between both ends. */
      contiguous: boolean;
    }
  | { tabs: number; sliced: boolean }
  | null {
  const touched = tabs.filter((t) =>
    t.episodes.some((e) => e.id && selected.has(e.id)),
  );
  if (touched.length === 0) return null;

  if (touched.length > 1) {
    return { tabs: touched.length, sliced: touched.some((t) => t.range) };
  }

  const numbers = touched[0].episodes
    .filter((e) => e.id && selected.has(e.id))
    .map((e) => e.number);
  const first = Math.min(...numbers);
  const last = Math.max(...numbers);
  return {
    tabs: 1,
    seasonNumber: touched[0].seasonNumber,
    first,
    last,
    contiguous: touched[0].episodes
      .filter((e) => e.number >= first && e.number <= last && isAired(e, now))
      .every((e) => e.id && selected.has(e.id)),
  };
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

const TMDB_SIZED = /(image\.tmdb\.org\/t\/p\/)w\d+\//;

/** A larger size of a TMDB still or poster; other hosts' images as they are. */
export function largeTmdbImage(url: string): string {
  return url.replace(TMDB_SIZED, "$1w780/");
}

/** YouTube's own preview frame for a video. */
export function videoThumbnail(key: string): string {
  return `https://i.ytimg.com/vi/${encodeURIComponent(key)}/hqdefault.jpg`;
}

/**
 * The episodes "previous/next" walks through: the whole regular run, season
 * after season — or the specials on their own, which sit outside it.
 */
export function playlist(
  seasons: MediaDetailSeasonDto[],
  seasonNumber: number,
): { season: number; episode: number }[] {
  return seasons
    .filter((s) => (seasonNumber === 0 ? s.number === 0 : s.number !== 0))
    .sort((a, b) => a.number - b.number)
    .flatMap((s) =>
      s.episodes.map((e) => ({ season: s.number, episode: e.number })),
    );
}
