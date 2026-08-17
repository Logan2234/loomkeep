import type { ImportMovie, ImportShow } from "../../media-import-model";
import type {
  TraktHistoryEntry,
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

  return [...byTraktId.values()].map((show) => ({
    title: show.title,
    externalIds: show.externalIds,
    episodes: [...show.episodes.values()],
  }));
}

/** Movie counterpart of {@link buildImportShows}. */
export function buildImportMovies(
  history: TraktHistoryEntry[],
  watchlist: TraktWatchlistEntry[],
): ImportMovie[] {
  const byTraktId = new Map<number, ImportMovie>();

  for (const entry of history) {
    if (entry.type !== "movie" || !entry.movie) continue;

    const watchedAt = toDateOrNull(entry.watched_at);
    const existing = byTraktId.get(entry.movie.ids.trakt);

    if (existing) {
      existing.watchedAt = earliest(existing.watchedAt, watchedAt);
    } else {
      byTraktId.set(entry.movie.ids.trakt, {
        title: entry.movie.title,
        year: entry.movie.year,
        watched: true,
        watchedAt,
        externalIds: toExternalIds(entry.movie.ids),
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
        watchedAt: null,
        externalIds: toExternalIds(entry.movie.ids),
      });
    }
  }

  return [...byTraktId.values()];
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
