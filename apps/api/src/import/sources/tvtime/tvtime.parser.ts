import type { TvTimeImportFilesDto } from "@loomkeep/shared";
import { parseCsv } from "../../../common/csv.util";
import { earlierOf } from "../../import-date.util";

/** One distinct watched episode of a show, with its rewatch count folded in. */
interface ParsedWatchedEpisode {
  season: number;
  episode: number;
  /** TheTVDB episode id (used to attach rewatch counts and ratings). */
  tvdbEpisodeId: string;
  /** Approximate — TV Time stores record-creation time, not real watch time. */
  watchedAt: Date | null;
  /** Base watch + rewatches. Always >= 1. */
  totalWatches: number;
  /** 1-10, from the episode's rating vote. */
  rating: number | null;
}

export interface ParsedShow {
  /** TheTVDB series id. */
  tvdbId: string;
  name: string;
  /** Distinct watched episodes; empty means the show is only on the watchlist. */
  episodes: ParsedWatchedEpisode[];
  favorite: boolean;
}

export interface ParsedMovie {
  title: string;
  year: number | null;
  /** true → watched (COMPLETED); false → watchlist (PLANNED). */
  watched: boolean;
  /** Earliest watch. Approximate — TV Time stores record-creation time, not real watch time. */
  watchedAt: Date | null;
  /** Extra watch dates beyond `watchedAt` (rewatches), oldest first. */
  rewatchedAt: Date[];
  /** 1-10, from the movie's rating vote. */
  rating: number | null;
  favorite: boolean;
}

type ParsedListItem =
  | { kind: "series"; tvdbId: string; name: string }
  | { kind: "movie"; title: string; year: number | null };

export interface ParsedList {
  name: string;
  description: string | null;
  items: ParsedListItem[];
}

export interface ParsedExport {
  shows: ParsedShow[];
  movies: ParsedMovie[];
  lists: ParsedList[];
}

/**
 * Turn the raw TV Time CSVs into the canonical intermediate model the importer
 * consumes. Pure and dependency-free so it can be unit-tested on samples.
 *
 * Source of truth for the watch history is `tracking-prod-records-v2.csv`: it
 * holds one row per watched episode (the legacy `seen_episode_*` tables are
 * partial). An episode counts as watched simply by appearing there — the
 * `ep_watch_count`/`rewatch_count` columns are summary fields, empty on most
 * rows, and are not the per-episode signal.
 */
export function parseTvTimeExport(files: TvTimeImportFilesDto): ParsedExport {
  const rewatchByEpisodeId = parseRewatches(files.rewatchedCsv);
  const names = parseShowNames(files.showsCsv);
  const shows = parseShows(files.episodesCsv, names, rewatchByEpisodeId);
  const { movies, movieByUuid } = parseMovies(files.recordsCsv);
  const votes = parseVotes(files);

  for (const show of shows) {
    for (const episode of show.episodes) {
      episode.rating = votes.byEpisodeId.get(episode.tvdbEpisodeId) ?? null;
    }
  }

  for (const [uuid, rating] of votes.byMovieUuid) {
    const movie = movieByUuid.get(uuid);
    if (movie) movie.rating = rating;
  }

  const { favorites, lists } = parseListRows(files.listsCsv);

  for (const show of shows) {
    show.favorite = favorites.seriesIds.has(show.tvdbId);
  }

  for (const uuid of favorites.movieUuids) {
    const movie = movieByUuid.get(uuid);
    if (movie) movie.favorite = true;
  }

  return {
    shows,
    movies,
    lists: lists.map((list) => ({
      name: list.name,
      description: list.description,
      items: list.objects.flatMap((object): ParsedListItem[] => {
        if (object.tvdbId) {
          const tvdbId = object.tvdbId;
          return [
            { kind: "series", tvdbId, name: names.get(tvdbId)?.name ?? tvdbId },
          ];
        }

        const movie = object.uuid ? movieByUuid.get(object.uuid) : undefined;
        return movie
          ? [{ kind: "movie", title: movie.title, year: movie.year }]
          : [];
      }),
    })),
  };
}

/** episode_id → number of rewatches (extra watches beyond the first). */
function parseRewatches(csv?: string): Map<string, number> {
  const map = new Map<string, number>();
  if (!csv) return map;

  for (const row of parseCsv(csv)) {
    const episodeId = row.episode_id?.trim();
    const cpt = toInt(row.cpt);

    if (episodeId && cpt !== null && cpt > 0) {
      map.set(episodeId, cpt);
    }
  }

  return map;
}

function parseShows(
  episodesCsv: string | undefined,
  names: Map<string, ShowNameEntry>,
  rewatchByEpisodeId: Map<string, number>,
): ParsedShow[] {
  const byTvdbId = new Map<string, ParsedShow>();

  // 1. Shows with watched episodes, from the source-of-truth table.
  for (const row of episodesCsv ? parseCsv(episodesCsv) : []) {
    // `bulk_type` (""/"fill-previous"/"season") only records HOW the watch was
    // entered — every row with an episode id is a real watched episode. Rows
    // without one (e.g. the series-follow record) are skipped just below.
    const tvdbId = row.s_id?.trim();
    const episodeId = row.episode_id?.trim();
    const season = toInt(row.season_number);
    const episode = toInt(row.episode_number);
    if (!tvdbId || !episodeId || season === null || episode === null) continue;

    let show = byTvdbId.get(tvdbId);

    if (!show) {
      show = {
        tvdbId,
        name: names.get(tvdbId)?.name ?? row.series_name?.trim() ?? tvdbId,
        episodes: [],
        favorite: false,
      };
      byTvdbId.set(tvdbId, show);
    }

    // The table has several rows per episode; keep the first, earliest date.
    const existing = show.episodes.find(
      (e) => e.season === season && e.episode === episode,
    );
    const watchedAt = toDateOrNull(row.created_at);

    if (existing) {
      existing.watchedAt = earlierOf(existing.watchedAt, watchedAt);
    } else {
      show.episodes.push({
        season,
        episode,
        tvdbEpisodeId: episodeId,
        watchedAt,
        totalWatches: 1 + (rewatchByEpisodeId.get(episodeId) ?? 0),
        rating: null,
      });
    }
  }

  // 2. Watchlist shows: still followed but never started (0 episodes seen).
  //    An unfollowed show stays in the table with its count, so the count
  //    alone would bring back a show the user dropped.
  for (const [tvdbId, entry] of names) {
    if (entry.followed && entry.nbSeen === 0 && !byTvdbId.has(tvdbId)) {
      byTvdbId.set(tvdbId, {
        tvdbId,
        name: entry.name,
        episodes: [],
        favorite: false,
      });
    }
  }

  return [...byTvdbId.values()];
}

interface ShowNameEntry {
  name: string;
  nbSeen: number;
  followed: boolean;
}

/** tv_show_id → { name, episodes-seen count, followed } from user_tv_show_data.csv. */
function parseShowNames(csv?: string): Map<string, ShowNameEntry> {
  const map = new Map<string, ShowNameEntry>();
  if (!csv) return map;

  for (const row of parseCsv(csv)) {
    const tvdbId = row.tv_show_id?.trim();
    if (!tvdbId) continue;
    map.set(tvdbId, {
      name: row.tv_show_name?.trim() || tvdbId,
      nbSeen: toInt(row.nb_episodes_seen) ?? 0,
      followed: row.is_followed?.trim() === "1",
    });
  }

  return map;
}

/** Movie accumulator while scanning tracking-prod-records.csv, before dates are sorted. */
interface MutableMovie {
  title: string;
  year: number | null;
  watched: boolean;
  dates: Date[];
}

/**
 * Movies from tracking-prod-records.csv: watched (`watch`/`rewatch` rows) vs
 * watchlist. Deduplicated by title only — the same movie shows up under
 * several `type` rows, sometimes with an empty `release_date`, so keying on
 * title+year would split it and let a later PLANNED row overwrite an earlier
 * COMPLETED one.
 *
 * `watch_date` is never populated for movies (only for the episode-summary
 * rows this same file also carries) — `created_at` is the only usable date,
 * same record-creation-time approximation as episodes. `type` disambiguates:
 * `watch` is the first watch, `rewatch` is one row per subsequent rewatch
 * (its own `created_at`, `rewatch_count` incrementing 1, 2, 3…), and
 * `rewatch_count` duplicates the latest `rewatch` row as a summary — not a
 * new event, skipped. `follow`/`towatch` carry no watch date.
 *
 * Each row's `uuid` is TV Time's id for the movie, the one its rating votes
 * and lists refer to it by, hence `movieByUuid`.
 */
function parseMovies(csv?: string): {
  movies: ParsedMovie[];
  movieByUuid: Map<string, ParsedMovie>;
} {
  if (!csv) return { movies: [], movieByUuid: new Map() };

  const byTitle = new Map<string, MutableMovie>();
  const titleByUuid = new Map<string, string>();

  for (const row of parseCsv(csv)) {
    if (row.entity_type?.trim() !== "movie") continue;

    const title = row.movie_name?.trim();
    if (!title) continue;
    const type = row.type?.trim();
    if (type === "rewatch_count") continue; // Duplicate summary row.

    const year = toYear(row.release_date);
    const watched = type === "watch" || type === "rewatch";
    const watchedAt = watched ? toDateOrNull(row.created_at) : null;

    const key = title.toLowerCase();
    const uuid = row.uuid?.trim();
    if (uuid) titleByUuid.set(uuid, key);
    const existing = byTitle.get(key);

    if (existing) {
      existing.watched ||= watched;
      if (existing.year === null && year !== null) existing.year = year;
      if (watchedAt) existing.dates.push(watchedAt);
    } else {
      byTitle.set(key, {
        title,
        year,
        watched,
        dates: watchedAt ? [watchedAt] : [],
      });
    }
  }

  const byKey = new Map(
    [...byTitle.entries()].map(([key, m]): [string, ParsedMovie] => {
      const sorted = [...m.dates].sort((a, b) => a.getTime() - b.getTime());
      return [
        key,
        {
          title: m.title,
          year: m.year,
          watched: m.watched,
          watchedAt: sorted[0] ?? null,
          rewatchedAt: sorted.slice(1),
          rating: null,
          favorite: false,
        },
      ];
    }),
  );

  return {
    movies: [...byKey.values()],
    movieByUuid: new Map(
      [...titleByUuid].map(([uuid, key]) => [uuid, byKey.get(key)!]),
    ),
  };
}

/**
 * TV Time's `stars_wording_scalev2` rating set: the vote code ending a
 * `vote_key` → its star (bad, ok, good, great, wow), doubled to 1-10. From
 * Trakt's own TV Time importer (`trakt/trakt-web`, checked there against TV
 * Time's ratings-set API), and borne out by a real export whose ratings had
 * been copied to Trakt. Any other code is no rating we know, and is skipped.
 */
const RATING_BY_VOTE_CODE: Record<string, number> = {
  "1": 2,
  "27": 4,
  "28": 6,
  "29": 8,
  "3": 10,
};

/**
 * The vote files, newest generation first, so a title rated in several takes
 * its newest vote. The files carry no date, so the order is their naming's,
 * as other TV Time importers read it too.
 */
const VOTE_FILES = [
  "movieVotesCsv",
  "votesV2Csv",
  "episodeVotesCsv",
  "legacyEpisodeVotesCsv",
] as const satisfies readonly (keyof TvTimeImportFilesDto)[];

/**
 * Rating votes by target: a movie by its uuid, an episode by its TVDB id.
 *
 * A file can hold two different votes for one target, with nothing to tell
 * which is current: that target is left unrated rather than guessed, and an
 * older file does not fill it in either.
 */
function parseVotes(files: TvTimeImportFilesDto): {
  byMovieUuid: Map<string, number>;
  byEpisodeId: Map<string, number>;
} {
  const movies = new Map<string, number | null>();
  const episodes = new Map<string, number | null>();

  for (const field of VOTE_FILES) {
    const csv = files[field];
    if (!csv) continue;

    const fileMovies = new Map<string, Set<number>>();
    const fileEpisodes = new Map<string, Set<number>>();

    for (const row of parseCsv(csv)) {
      const code = row.vote_key?.trim().split("-").pop() ?? "";
      const rating = RATING_BY_VOTE_CODE[code];
      if (rating === undefined) continue;

      // Movie rows carry episode_id 0 next to their uuid.
      const episodeId = row.episode_id?.trim();
      const isEpisode = !!episodeId && episodeId !== "0";
      const key = isEpisode ? episodeId : row.uuid?.trim();
      if (!key) continue;

      const target = isEpisode ? fileEpisodes : fileMovies;
      target.set(key, (target.get(key) ?? new Set()).add(rating));
    }

    for (const [fileVotes, all] of [
      [fileMovies, movies],
      [fileEpisodes, episodes],
    ] as const) {
      for (const [key, ratings] of fileVotes) {
        if (all.has(key)) continue;
        all.set(key, ratings.size === 1 ? [...ratings][0] : null);
      }
    }
  }

  return {
    byMovieUuid: withoutNulls(movies),
    byEpisodeId: withoutNulls(episodes),
  };
}

function withoutNulls(map: Map<string, number | null>): Map<string, number> {
  return new Map(
    [...map].filter((entry): entry is [string, number] => entry[1] !== null),
  );
}

/** One `map[…]` of a list's `objects`: a series by TVDB id, a movie by uuid. */
interface ListObject {
  tvdbId: string | null;
  uuid: string | null;
}

/**
 * `lists-prod-lists.csv` holds three kinds of rows. `collection` (and
 * `count`) are metadata: `collection`'s `lists` column restates every list
 * with its name, which a list's own row may leave empty. `favorite-series`
 * and `favorite-movies` are the user's favorites, exported in list shape.
 * Every other `type=list` row is a custom list.
 *
 * `objects` and `lists` are Go-printed maps
 * (`[map[created_at:1.6e+09 id:78804 type:series] map[… type:movie uuid:…]]`),
 * not JSON. Their keys print alphabetically, which is what lets a name with
 * spaces be cut out before the key that follows it.
 */
function parseListRows(csv?: string): {
  favorites: { seriesIds: Set<string>; movieUuids: Set<string> };
  lists: { name: string; description: string | null; objects: ListObject[] }[];
} {
  const favorites = {
    seriesIds: new Set<string>(),
    movieUuids: new Set<string>(),
  };
  const lists: {
    name: string;
    description: string | null;
    objects: ListObject[];
  }[] = [];
  if (!csv) return { favorites, lists };

  const rows = parseCsv(csv);
  const collection = rows.find((row) => row.s_key?.trim() === "collection");
  const nameByKey = new Map(
    goMaps(collection?.lists).flatMap((entry) => {
      const name = /(?:^|\s)name:(.*?) (?:order|posters|related|s_key):/
        .exec(entry)?.[1]
        ?.trim();
      const key = /(?:^|\s)s_key:([^\s\]]+)/.exec(entry)?.[1];
      return name && name !== "<nil>" && key ? [[key, name] as const] : [];
    }),
  );

  for (const row of rows) {
    const key = row.s_key?.trim();
    if (!key || row.type?.trim() !== "list") continue;
    const objects = goMaps(row.objects).map(toListObject);

    if (key === "favorite-series" || key === "favorite-movies") {
      for (const object of objects) {
        if (object.tvdbId) favorites.seriesIds.add(object.tvdbId);
        if (object.uuid) favorites.movieUuids.add(object.uuid);
      }

      continue;
    }

    // A list TV Time never named anywhere has nothing to be called here.
    const name = row.name?.trim() || nameByKey.get(key);
    if (!name) continue;
    const description = row.description?.trim();
    lists.push({
      name,
      description: description && description !== "<nil>" ? description : null,
      objects,
    });
  }

  return { favorites, lists };
}

/** The inside of each `map[…]` of a Go-printed value. */
function goMaps(value: string | undefined): string[] {
  return (value ?? "").split("map[").slice(1);
}

function toListObject(entry: string): ListObject {
  const type = /(?:^|\s)type:(\w+)/.exec(entry)?.[1];
  // A series also carries a uuid; only its TVDB id names it in the catalogue.
  return type === "series"
    ? { tvdbId: /(?:^|\s)id:(\d+)/.exec(entry)?.[1] ?? null, uuid: null }
    : { tvdbId: null, uuid: /(?:^|\s)uuid:([\w-]+)/.exec(entry)?.[1] ?? null };
}

function toInt(value: string | undefined): number | null {
  if (value === undefined || value.trim() === "") return null;
  const n = Number.parseInt(value.trim(), 10);
  return Number.isNaN(n) ? null : n;
}

function toYear(value: string | undefined): number | null {
  if (!value) return null;
  const year = Number.parseInt(value.trim().slice(0, 4), 10);
  return Number.isNaN(year) ? null : year;
}

/**
 * Parses "2025-11-24 19:24:43" (and ISO); returns null on anything unusable.
 * TV Time timestamps carry no zone — treat them as UTC so imported dates do
 * not drift with the server's local offset.
 */
function toDateOrNull(value: string | undefined): Date | null {
  if (!value || value.trim() === "") return null;
  let normalized = value.trim().replace(" ", "T");
  if (!/[Zz]|[+-]\d\d:?\d\d$/.test(normalized)) normalized += "Z";
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}
