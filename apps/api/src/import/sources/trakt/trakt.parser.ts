import { earlierOf, parseDateOrNull } from "../../import-date.util";
import type { ImportMovie, ImportShow } from "../../media-import-model";
import type {
  TraktEpisodeRatingEntry,
  TraktFavoriteEntry,
  TraktHistoryEntry,
  TraktMovieRatingEntry,
  TraktMovieRef,
  TraktSeasonRatingEntry,
  TraktShowRatingEntry,
  TraktShowRef,
  TraktWatchlistEntry,
} from "./trakt-export.types";

interface MutableEpisode {
  season: number;
  episode: number;
  sourceEpisodeId: string;
  watchedAt: Date | null;
  totalWatches: number;
}

/** The three show-side ratings files of the export, each optional. */
export interface TraktShowRatings {
  shows?: TraktShowRatingEntry[];
  seasons?: TraktSeasonRatingEntry[];
  episodes?: TraktEpisodeRatingEntry[];
}

/**
 * Turn Trakt's export into the canonical media import model.
 *
 * `history` is one row per watch **event** (confirmed a strict superset of
 * the aggregate `watched-shows.json`/`watched-movies.json` files against a
 * real export — those carry no per-episode breakdown), so it alone gives us
 * both watched movies and per-episode show data; repeated events for the
 * same episode/movie fold into a rewatch count / an earliest-watched date,
 * exactly like the TV Time and Trakt-API importers already do.
 *
 * Trakt lets a user rate a title without marking it watched. A rated show
 * that nothing else mentions still enters the import, on the watchlist, so
 * its ratings are not lost. An episode rating only lands on an episode the
 * history has: a rating says nothing about how far the user got.
 */
export function buildImportShows(
  history: TraktHistoryEntry[],
  watchlist: TraktWatchlistEntry[],
  favorites: TraktFavoriteEntry[] = [],
  ratings: TraktShowRatings = {},
): ImportShow[] {
  const byTraktId = new Map<
    number,
    {
      title: string;
      externalIds: ImportShow["externalIds"];
      episodes: Map<string, MutableEpisode>;
    }
  >();

  const showFor = (ref: TraktShowRef) => {
    let show = byTraktId.get(ref.ids.trakt);

    if (!show) {
      show = {
        title: ref.title,
        externalIds: toExternalIds(ref.ids),
        episodes: new Map(),
      };
      byTraktId.set(ref.ids.trakt, show);
    }

    return show;
  };

  for (const entry of history) {
    if (entry.type !== "episode" || !entry.show || !entry.episode) continue;

    const show = showFor(entry.show);
    const { season, number: episode } = entry.episode;
    const key = `${season}|${episode}`;
    const watchedAt = parseDateOrNull(entry.watched_at);
    const existing = show.episodes.get(key);

    if (existing) {
      existing.totalWatches++;
      existing.watchedAt = earlierOf(existing.watchedAt, watchedAt);
    } else {
      show.episodes.set(key, {
        season,
        episode,
        sourceEpisodeId: `${season}x${episode}`,
        watchedAt,
        totalWatches: 1,
      });
    }
  }

  for (const entry of watchlist) {
    if (entry.type === "show" && entry.show) showFor(entry.show);
  }

  const showRatings = ratings.shows ?? [];
  const seasonRatings = ratings.seasons ?? [];
  const episodeRatings = ratings.episodes ?? [];

  for (const entry of [...showRatings, ...seasonRatings, ...episodeRatings]) {
    showFor(entry.show);
  }

  const favoriteIds = new Set(
    favorites
      .filter(
        (e): e is typeof e & { show: NonNullable<typeof e.show> } =>
          e.type === "show" && !!e.show,
      )
      .map((e) => e.show.ids.trakt),
  );
  const ratingById = new Map(
    showRatings.map((r) => [r.show.ids.trakt, r.rating]),
  );
  const seasonRatingsById = new Map<
    number,
    { season: number; rating: number }[]
  >();

  for (const r of seasonRatings) {
    const list = seasonRatingsById.get(r.show.ids.trakt) ?? [];
    list.push({ season: r.season.number, rating: r.rating });
    seasonRatingsById.set(r.show.ids.trakt, list);
  }

  const episodeRatingByKey = new Map(
    episodeRatings.map((r) => [
      `${r.show.ids.trakt}|${r.episode.season}|${r.episode.number}`,
      r.rating,
    ]),
  );

  return [...byTraktId.entries()].map(([traktId, show]) => ({
    title: show.title,
    externalIds: show.externalIds,
    episodes: [...show.episodes.values()].map((ep) => ({
      ...ep,
      rating:
        episodeRatingByKey.get(`${traktId}|${ep.season}|${ep.episode}`) ?? null,
    })),
    favorite: favoriteIds.has(traktId),
    rating: ratingById.get(traktId) ?? null,
    seasonRatings: seasonRatingsById.get(traktId) ?? [],
  }));
}

/** Movie accumulator while scanning history, before its dates are sorted. */
interface MutableMovie {
  title: string;
  year: number | null;
  watched: boolean;
  externalIds: ImportMovie["externalIds"];
  // Every watch event's date, unsorted — the earliest becomes `watchedAt`,
  //  the rest become `rewatchedAt`.
  dates: Date[];
}

/**
 * Movie counterpart of {@link buildImportShows}: a movie rated but never
 * watched is kept as not watched, carrying its rating.
 */
export function buildImportMovies(
  history: TraktHistoryEntry[],
  watchlist: TraktWatchlistEntry[],
  favorites: TraktFavoriteEntry[] = [],
  ratings: TraktMovieRatingEntry[] = [],
): ImportMovie[] {
  const byTraktId = new Map<number, MutableMovie>();

  const addUnwatched = (ref: TraktMovieRef) => {
    if (byTraktId.has(ref.ids.trakt)) return;
    byTraktId.set(ref.ids.trakt, {
      title: ref.title,
      year: ref.year,
      watched: false,
      externalIds: toExternalIds(ref.ids),
      dates: [],
    });
  };

  for (const entry of history) {
    if (entry.type !== "movie" || !entry.movie) continue;

    const watchedAt = parseDateOrNull(entry.watched_at);
    const existing = byTraktId.get(entry.movie.ids.trakt);

    if (existing) {
      if (watchedAt) existing.dates.push(watchedAt);
    } else {
      byTraktId.set(entry.movie.ids.trakt, {
        title: entry.movie.title,
        year: entry.movie.year,
        watched: true,
        externalIds: toExternalIds(entry.movie.ids),
        dates: watchedAt ? [watchedAt] : [],
      });
    }
  }

  for (const entry of watchlist) {
    if (entry.type === "movie" && entry.movie) addUnwatched(entry.movie);
  }

  for (const entry of ratings) addUnwatched(entry.movie);

  const favoriteIds = new Set(
    favorites
      .filter(
        (e): e is typeof e & { movie: NonNullable<typeof e.movie> } =>
          e.type === "movie" && !!e.movie,
      )
      .map((e) => e.movie.ids.trakt),
  );
  const ratingById = new Map(ratings.map((r) => [r.movie.ids.trakt, r.rating]));

  return [...byTraktId.entries()].map(([traktId, movie]) => {
    const sorted = [...movie.dates].sort((a, b) => a.getTime() - b.getTime());
    return {
      title: movie.title,
      year: movie.year,
      watched: movie.watched,
      watchedAt: sorted[0] ?? null,
      rewatchedAt: sorted.slice(1),
      externalIds: movie.externalIds,
      favorite: favoriteIds.has(traktId),
      rating: ratingById.get(traktId) ?? null,
    };
  });
}

function toExternalIds(ids: {
  tmdb?: number;
  tvdb?: number;
  imdb?: string;
}): ImportShow["externalIds"] {
  return {
    tmdb: ids.tmdb !== undefined ? String(ids.tmdb) : undefined,
    tvdb: ids.tvdb !== undefined ? String(ids.tvdb) : undefined,
    imdb: ids.imdb,
  };
}
