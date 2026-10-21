import type { EntryStatus } from "@loomkeep/shared";
import { parseDateOrNull } from "../../import-date.util";
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
      watchedAt: parseDateOrNull(ep.watched_at),
      // Simkl's free tier has no per-episode rewatch count (that needs the
      // Pro/VIP-only `allow_rewatch` flag) — every watched episode counts once.
      totalWatches: 1,
    })),
  );

  return {
    title: entry.show.title,
    externalIds: toExternalIds(entry.show.ids),
    episodes,
    // Other statuses follow from the episodes. On hold reads as still in
    // progress, as MyAnimeList's On-Hold and AniList's PAUSED do.
    status: SHOW_STATUS[entry.status],
    ...extras(entry),
  };
}

const SHOW_STATUS: Partial<Record<SimklShowEntry["status"], EntryStatus>> = {
  dropped: "DROPPED",
  hold: "WATCHING",
};

function toImportMovie(entry: SimklMovieEntry): ImportMovie {
  // Movies only ever carry plantowatch/completed/dropped.
  const watched = entry.status === "completed";
  return {
    title: entry.movie.title,
    year: entry.movie.year,
    watched,
    watchedAt: watched ? parseDateOrNull(entry.last_watched_at) : null,
    // Simkl's free tier has no per-movie rewatch signal (that needs the
    // Pro/VIP-only `allow_rewatch` flag) — every watched movie counts once.
    rewatchedAt: [],
    externalIds: toExternalIds(entry.movie.ids),
    // A film dropped midway was not seen: it is dropped, not completed.
    ...(entry.status === "dropped" && { status: "DROPPED" as const }),
    ...extras(entry),
  };
}

function extras(
  entry: SimklShowEntry | SimklMovieEntry,
): Pick<ImportShow, "rating" | "notes" | "addedAt"> {
  return {
    rating: entry.user_rating ?? null,
    notes: entry.memo?.text?.trim() || null,
    addedAt: parseDateOrNull(entry.added_to_watchlist_at ?? undefined),
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
