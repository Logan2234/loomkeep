import type { EntryStatus } from "@loomkeep/shared";

/** An episode as both sides know it: its number in its season, its air date. */
interface DatedEpisode {
  number: number;
  airDate: Date | null;
}

export interface DatedSeason {
  number: number;
  episodes: DatedEpisode[];
}

/** Where a TMDB episode sits: its season number and its number in it. */
export interface EpisodeCoord {
  season: number;
  episode: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
// TMDB dates are Japanese calendar days, AniList's exact broadcast times in
// UTC: a late-night broadcast lands on the day before.
const ANCHOR_TOLERANCE_MS = 1 * DAY_MS;
const EPISODE_TOLERANCE_MS = 2 * DAY_MS;

// What sets a sequel's or a part's title apart from the show's own.
const SEQUEL_SUFFIXES = [
  /\s*[:：-]\s.*$/u,
  /\s*\b(?:season|saison)\s*\d+.*$/iu,
  /\s*\b\d+(?:st|nd|rd|th)\s+season.*$/iu,
  /\s*\b(?:part|cour)\s*\d+.*$/iu,
  /\s*第\s*\d+\s*期.*$/u,
  /\s+(?:\d+|II|III|IV)$/u,
];

function normalizeTitle(title: string): string {
  return title
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
}

/** The title with its sequel or part suffix cut off ("Season 2", "Part 2"…). */
export function baseTitle(title: string): string {
  return SEQUEL_SUFFIXES.reduce((t, re) => t.replace(re, ""), title).trim();
}

/**
 * Whether a TMDB show's titles name the AniList work: the same title once
 * the sequel suffix is cut, or the AniList title starting with it.
 */
export function titlesMatch(
  anilistTitles: (string | null)[],
  tmdbTitles: (string | null)[],
): boolean {
  const ours = anilistTitles
    .filter((t): t is string => !!t)
    .flatMap((t) => [normalizeTitle(t), normalizeTitle(baseTitle(t))])
    .filter((t) => t.length > 0);
  const theirs = tmdbTitles
    .filter((t): t is string => !!t)
    .map(normalizeTitle)
    .filter((t) => t.length > 0);

  return ours.some((a) =>
    theirs.some((t) => a === t || (t.length >= 4 && a.startsWith(t))),
  );
}

/**
 * The TMDB episodes, in viewing order, an anchor walks through: the regular
 * seasons one after the other, or the specials alone.
 */
function episodeTrack(
  seasons: DatedSeason[],
  specials: boolean,
): (EpisodeCoord & { airDate: Date | null })[] {
  return seasons
    .filter((s) => (specials ? s.number === 0 : s.number > 0))
    .sort((a, b) => a.number - b.number)
    .flatMap((s) =>
      [...s.episodes]
        .sort((a, b) => a.number - b.number)
        .map((e) => ({
          season: s.number,
          episode: e.number,
          airDate: e.airDate,
        })),
    );
}

/**
 * The TMDB episodes that aired the day the AniList work started: where its
 * first episode sits in the show. Regular seasons first; the specials only
 * when no regular episode matches (an OVA filed under season 0). Of a
 * premiere airing several episodes at once, only the first counts.
 */
export function findAnchors(
  seasons: DatedSeason[],
  start: Date,
): EpisodeCoord[] {
  const near = (specials: boolean) => {
    const track = episodeTrack(seasons, specials);

    const isNear = (i: number) => {
      const airDate = track[i]?.airDate;
      return (
        !!airDate &&
        Math.abs(airDate.getTime() - start.getTime()) <= ANCHOR_TOLERANCE_MS
      );
    };

    return track
      .filter((_, i) => isNear(i) && !isNear(i - 1))
      .map(({ season, episode }) => ({ season, episode }));
  };

  const regular = near(false);
  return regular.length > 0 ? regular : near(true);
}

type EpisodeMapping =
  | { ok: true; coords: Map<number, EpisodeCoord> }
  | { ok: false; reason: string };

/**
 * Maps the AniList episodes (numbered from 1) onto the TMDB track from the
 * anchor on, episode by episode. Fails when TMDB lists fewer episodes than
 * the ones to map, or when an episode both sides date aired days apart.
 */
export function mapEpisodes(
  seasons: DatedSeason[],
  anchor: EpisodeCoord,
  anilistEpisodes: DatedEpisode[],
  mustMap: Set<number>,
): EpisodeMapping {
  const track = episodeTrack(seasons, anchor.season === 0);
  const start = track.findIndex(
    (e) => e.season === anchor.season && e.episode === anchor.episode,
  );
  if (start < 0) return { ok: false, reason: "anchor not in TMDB listing" };

  const coords = new Map<number, EpisodeCoord>();

  for (const episode of anilistEpisodes) {
    const target = track[start + episode.number - 1];

    if (!target) {
      if (mustMap.has(episode.number)) {
        return {
          ok: false,
          reason: `watched episode ${episode.number} is past TMDB's listing`,
        };
      }

      continue;
    }

    if (
      episode.airDate &&
      target.airDate &&
      Math.abs(episode.airDate.getTime() - target.airDate.getTime()) >
        EPISODE_TOLERANCE_MS
    ) {
      return {
        ok: false,
        reason: `episode ${episode.number} aired on another day on TMDB (S${target.season}E${target.episode})`,
      };
    }

    coords.set(episode.number, {
      season: target.season,
      episode: target.episode,
    });
  }

  return { ok: true, coords };
}

/**
 * Two entries of one user end up on the same show (two cours of it): one in
 * progress, or one done while the other isn't, makes the show in progress.
 */
export function mergeStatus(a: EntryStatus, b: EntryStatus): EntryStatus {
  if (a === b) return a;
  if (a === "WATCHING" || b === "WATCHING") return "WATCHING";
  if (a === "COMPLETED" || b === "COMPLETED") return "WATCHING";
  return a;
}
