import type { ImportMovie, ImportShow } from "../../media-import-model";
import type {
  SimklAllItemsResponse,
  SimklIds,
  SimklMovieEntry,
  SimklShowEntry,
} from "./simkl-api.types";

/**
 * Turn a Simkl `/sync/all-items` response into the canonical media import
 * model. Shows and anime share the same entry shape (both keyed under
 * `show`), so both buckets feed the same show list — anime is resolved
 * against TMDB just like a regular show for now (matches TV Time's current
 * behaviour; a dedicated AniList path is future work).
 */
export function buildImportShows(data: SimklAllItemsResponse): ImportShow[] {
  return [...(data.shows ?? []), ...(data.anime ?? [])].map(toImportShow);
}

export function buildImportMovies(data: SimklAllItemsResponse): ImportMovie[] {
  return (data.movies ?? []).map(toImportMovie);
}

function toImportShow(entry: SimklShowEntry): ImportShow {
  const episodes = (entry.seasons ?? []).flatMap((season) =>
    season.episodes.map((ep) => ({
      season: season.number,
      episode: ep.number,
      sourceEpisodeId: `${season.number}x${ep.number}`,
      watchedAt: toDateOrNull(ep.watched_at),
      // Simkl's free tier has no per-episode rewatch count (that needs the
      // Pro/VIP-only `allow_rewatch` flag) — every watched episode counts once.
      totalWatches: 1,
    })),
  );

  return {
    title: entry.show.title,
    externalIds: toExternalIds(entry.show.ids),
    episodes,
  };
}

function toImportMovie(entry: SimklMovieEntry): ImportMovie {
  return {
    title: entry.movie.title,
    year: entry.movie.year,
    // Movies only ever carry plantowatch/completed/dropped — anything but
    // "still on the watchlist" counts as watched.
    watched: entry.status !== "plantowatch",
    externalIds: toExternalIds(entry.movie.ids),
  };
}

function toExternalIds(ids: SimklIds) {
  return {
    tmdb: ids.tmdb,
    tvdb: ids.tvdb,
    imdb: ids.imdb,
    anilist: ids.anilist,
  };
}

function toDateOrNull(value: string | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
