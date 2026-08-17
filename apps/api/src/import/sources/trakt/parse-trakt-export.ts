import type { ImportMovie, ImportShow } from "../../media-import-model";
import type {
  TraktFavoriteEntry,
  TraktHistoryEntry,
  TraktMovieRatingEntry,
  TraktShowRatingEntry,
  TraktWatchlistEntry,
} from "./trakt-export.types";

interface MutableEpisode {
  season: number;
  episode: number;
  sourceEpisodeId: string;
  watchedAt: Date | null;
  totalWatches: number;
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
 */
export function buildImportShows(
  history: TraktHistoryEntry[],
  watchlist: TraktWatchlistEntry[],
  favorites: TraktFavoriteEntry[] = [],
  ratings: TraktShowRatingEntry[] = [],
): ImportShow[] {
  const byTraktId = new Map<
    number,
    {
      title: string;
      externalIds: ImportShow["externalIds"];
      episodes: Map<string, MutableEpisode>;
    }
  >();

  for (const entry of history) {
    if (entry.type !== "episode" || !entry.show || !entry.episode) continue;

    let show = byTraktId.get(entry.show.ids.trakt);

    if (!show) {
      show = {
        title: entry.show.title,
        externalIds: toExternalIds(entry.show.ids),
        episodes: new Map(),
      };
      byTraktId.set(entry.show.ids.trakt, show);
    }

    const { season, number: episode } = entry.episode;
    const key = `${season}|${episode}`;
    const watchedAt = toDateOrNull(entry.watched_at);
    const existing = show.episodes.get(key);

    if (existing) {
      existing.totalWatches++;
      existing.watchedAt = earliest(existing.watchedAt, watchedAt);
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
    if (entry.type !== "show" || !entry.show) continue;

    if (!byTraktId.has(entry.show.ids.trakt)) {
      byTraktId.set(entry.show.ids.trakt, {
        title: entry.show.title,
        externalIds: toExternalIds(entry.show.ids),
        episodes: new Map(),
      });
    }
  }

  const favoriteIds = new Set(
    favorites
      .filter((e) => e.type === "show" && e.show)
      .map((e) => e.show!.ids.trakt),
  );
  const ratingById = new Map(ratings.map((r) => [r.show.ids.trakt, r.rating]));

  return [...byTraktId.entries()].map(([traktId, show]) => ({
    title: show.title,
    externalIds: show.externalIds,
    episodes: [...show.episodes.values()],
    favorite: favoriteIds.has(traktId),
    rating: ratingById.get(traktId) ?? null,
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

/** Movie counterpart of {@link buildImportShows}. */
export function buildImportMovies(
  history: TraktHistoryEntry[],
  watchlist: TraktWatchlistEntry[],
  favorites: TraktFavoriteEntry[] = [],
  ratings: TraktMovieRatingEntry[] = [],
): ImportMovie[] {
  const byTraktId = new Map<number, MutableMovie>();

  for (const entry of history) {
    if (entry.type !== "movie" || !entry.movie) continue;

    const watchedAt = toDateOrNull(entry.watched_at);
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
    if (entry.type !== "movie" || !entry.movie) continue;

    if (!byTraktId.has(entry.movie.ids.trakt)) {
      byTraktId.set(entry.movie.ids.trakt, {
        title: entry.movie.title,
        year: entry.movie.year,
        watched: false,
        externalIds: toExternalIds(entry.movie.ids),
        dates: [],
      });
    }
  }

  const favoriteIds = new Set(
    favorites
      .filter((e) => e.type === "movie" && e.movie)
      .map((e) => e.movie!.ids.trakt),
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

function toDateOrNull(value: string | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function earliest(a: Date | null, b: Date | null): Date | null {
  if (!a) return b;
  if (!b) return a;
  return a < b ? a : b;
}
