import type { ImportMovie, ImportShow } from "../../media-import-model";
import type {
  TraktIds,
  TraktWatchedMovie,
  TraktWatchedShow,
  TraktWatchlistMovieItem,
  TraktWatchlistShowItem,
} from "./trakt-api.types";

/**
 * Turn a Trakt user's watched + watchlist shows into the canonical media
 * import model. A show already in the watched list is never duplicated from
 * the watchlist (Trakt lists a show on both once you start it) — keyed by
 * its (stable, always-present) Trakt id.
 */
export function buildImportShows(
  watched: TraktWatchedShow[],
  watchlist: TraktWatchlistShowItem[],
): ImportShow[] {
  const byTraktId = new Map<number, ImportShow>();

  for (const entry of watched) {
    byTraktId.set(entry.show.ids.trakt, {
      title: entry.show.title,
      externalIds: toExternalIds(entry.show.ids),
      episodes: entry.seasons.flatMap((season) =>
        season.episodes.map((ep) => ({
          season: season.number,
          episode: ep.number,
          sourceEpisodeId: `${season.number}x${ep.number}`,
          watchedAt: toDateOrNull(ep.last_watched_at),
          totalWatches: Math.max(1, ep.plays),
        })),
      ),
    });
  }

  for (const item of watchlist) {
    if (!byTraktId.has(item.show.ids.trakt)) {
      byTraktId.set(item.show.ids.trakt, {
        title: item.show.title,
        externalIds: toExternalIds(item.show.ids),
        episodes: [],
      });
    }
  }

  return [...byTraktId.values()];
}

/** Movie counterpart of {@link buildImportShows}. */
export function buildImportMovies(
  watched: TraktWatchedMovie[],
  watchlist: TraktWatchlistMovieItem[],
): ImportMovie[] {
  const byTraktId = new Map<number, ImportMovie>();

  for (const entry of watched) {
    byTraktId.set(entry.movie.ids.trakt, {
      title: entry.movie.title,
      year: entry.movie.year,
      watched: true,
      externalIds: toExternalIds(entry.movie.ids),
    });
  }

  for (const item of watchlist) {
    if (!byTraktId.has(item.movie.ids.trakt)) {
      byTraktId.set(item.movie.ids.trakt, {
        title: item.movie.title,
        year: item.movie.year,
        watched: false,
        externalIds: toExternalIds(item.movie.ids),
      });
    }
  }

  return [...byTraktId.values()];
}

function toExternalIds(ids: TraktIds) {
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
