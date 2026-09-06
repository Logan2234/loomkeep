import type {
  CastDetailDto,
  MediaExtrasDto,
  MediaSummaryDto,
  RatingDto,
  WatchProviderDto,
} from "@loomkeep/shared";
import { CatalogSource, MediaSource, MediaType } from "@loomkeep/shared";
import type {
  ProviderExternalId,
  ProviderMediaDetails,
  ProviderSeason,
} from "./provider.types";

// TMDB's terms forbid using its API as an image host — never download/cache
// these and serve them from Loomkeep's own infra. URLs are only ever handed
// to the client, which loads them straight from image.tmdb.org.
const IMG = "https://image.tmdb.org/t/p";

export interface TmdbMovieResult {
  id: number;
  title: string;
  original_title?: string;
  release_date?: string;
  poster_path?: string | null;
  adult?: boolean;
}

export interface TmdbTvResult {
  id: number;
  name: string;
  original_name?: string;
  first_air_date?: string;
  poster_path?: string | null;
}

interface TmdbExternalIds {
  imdb_id?: string | null;
  tvdb_id?: number | null;
}

export interface TmdbMovieDetails extends TmdbMovieResult {
  overview?: string | null;
  backdrop_path?: string | null;
  genres?: { name: string }[];
  status?: string | null;
  runtime?: number | null;
  external_ids?: TmdbExternalIds;
}

export interface TmdbTvDetails extends TmdbTvResult {
  overview?: string | null;
  backdrop_path?: string | null;
  genres?: { name: string }[];
  status?: string | null;
  // TMDB reports per-episode runtimes as an array (usually one value).
  episode_run_time?: number[];
  external_ids?: TmdbExternalIds;
  seasons?: { season_number: number; name?: string | null }[];
}

interface TmdbCrewMember {
  id: number;
  name: string;
  job?: string;
}

interface TmdbVideo {
  site: string; // "YouTube" | "Vimeo" | …
  type: string; // "Trailer" | "Teaser" | "Clip" | …
  key: string; // YouTube video id.
  official?: boolean;
}

interface TmdbReleaseDate {
  certification?: string;
}

interface TmdbReleaseDatesResult {
  iso_3166_1: string;
  release_dates: TmdbReleaseDate[];
}

interface TmdbContentRatingsResult {
  iso_3166_1: string;
  rating: string;
}

export interface TmdbSeasonDetails {
  episodes?: {
    episode_number: number;
    name?: string | null;
    air_date?: string | null;
  }[];
}

interface TmdbWatchProvider {
  provider_name: string;
  logo_path?: string | null;
}

interface TmdbWatchRegion {
  link?: string;
  flatrate?: TmdbWatchProvider[];
  rent?: TmdbWatchProvider[];
  buy?: TmdbWatchProvider[];
}

export interface TmdbExtras {
  tagline?: string | null;
  vote_average?: number;
  vote_count?: number;
  // TV only — the show's own creator(s)/showrunner(s), a base field (no
  // append_to_response needed) with no per-movie equivalent.
  created_by?: { id: number; name: string }[];
  credits?: {
    cast?: {
      id: number;
      name: string;
      character?: string;
      profile_path?: string | null;
    }[];
    crew?: TmdbCrewMember[];
  };
  videos?: { results?: TmdbVideo[] };
  // Movie only (append_to_response=release_dates).
  release_dates?: { results?: TmdbReleaseDatesResult[] };
  // TV only (append_to_response=content_ratings).
  content_ratings?: { results?: TmdbContentRatingsResult[] };
  recommendations?: { results?: (TmdbMovieResult | TmdbTvResult)[] };
  "watch/providers"?: { results?: Record<string, TmdbWatchRegion> };
  external_ids?: { imdb_id?: string | null };
  images?: { backdrops?: { file_path: string }[] };
}

// Capped so the lightbox gallery stays a quick browse, not an endless scroll.
const MAX_GALLERY_IMAGES = 12;

/** One entry of a person's `combined_credits.cast` (movie or TV role). */
type TmdbCreditItem = (TmdbMovieResult | TmdbTvResult) & {
  media_type: "movie" | "tv";
  popularity?: number;
};

export interface TmdbPersonDetails {
  name: string;
  biography?: string | null;
  birthday?: string | null;
  deathday?: string | null;
  place_of_birth?: string | null;
  profile_path?: string | null;
  homepage?: string | null;
  external_ids?: { imdb_id?: string | null; wikidata_id?: string | null };
  combined_credits?: { cast?: TmdbCreditItem[] };
}

export interface TmdbFindResult {
  // `/find` returns full objects, so an external-id lookup already carries the
  // metadata needed to display the match — no extra details call.
  tv_results?: TmdbTvResult[];
  movie_results?: TmdbMovieResult[];
}

export function toMovieSummary(movie: TmdbMovieResult): MediaSummaryDto {
  return {
    source: CatalogSource.TMDB,
    sourceId: String(movie.id),
    type: MediaType.MOVIE,
    title: movie.title,
    originalTitle: movie.original_title ?? null,
    year: movie.release_date ? Number(movie.release_date.slice(0, 4)) : null,
    posterUrl: movie.poster_path ? `${IMG}/w500${movie.poster_path}` : null,
    isAdult: movie.adult ?? false,
  };
}

export function toTvSummary(tv: TmdbTvResult): MediaSummaryDto {
  return {
    source: CatalogSource.TMDB,
    sourceId: String(tv.id),
    type: MediaType.SERIES,
    title: tv.name,
    originalTitle: tv.original_name ?? null,
    year: tv.first_air_date ? Number(tv.first_air_date.slice(0, 4)) : null,
    posterUrl: tv.poster_path ? `${IMG}/w500${tv.poster_path}` : null,
    // TMDB's TV catalogue carries no `adult` flag (its pornographic
    // catalogue is movies-only).
    isAdult: false,
  };
}

function toExternalIds(
  tmdbId: string,
  ids?: TmdbExternalIds,
): ProviderExternalId[] {
  const externalIds: ProviderExternalId[] = [
    { source: MediaSource.TMDB, externalId: tmdbId },
  ];

  if (ids?.imdb_id) {
    externalIds.push({ source: MediaSource.IMDB, externalId: ids.imdb_id });
  }

  if (ids?.tvdb_id) {
    externalIds.push({
      source: MediaSource.TVDB,
      externalId: String(ids.tvdb_id),
    });
  }

  return externalIds;
}

export function toMovieDetails(movie: TmdbMovieDetails): ProviderMediaDetails {
  return {
    summary: toMovieSummary(movie),
    overview: movie.overview ?? null,
    backdropUrl: movie.backdrop_path
      ? `${IMG}/w1280${movie.backdrop_path}`
      : null,
    genres: movie.genres?.map((g) => g.name) ?? [],
    status: movie.status ?? null,
    releaseDate: movie.release_date || null,
    runtimeMin: movie.runtime ?? null,
    externalIds: toExternalIds(String(movie.id), movie.external_ids),
    seasons: [],
  };
}

export function toTvDetails(
  tv: TmdbTvDetails,
  seasons: ProviderSeason[],
): ProviderMediaDetails {
  return {
    summary: toTvSummary(tv),
    overview: tv.overview ?? null,
    backdropUrl: tv.backdrop_path ? `${IMG}/w1280${tv.backdrop_path}` : null,
    genres: tv.genres?.map((g) => g.name) ?? [],
    status: tv.status ?? null,
    releaseDate: tv.first_air_date || null,
    runtimeMin: tv.episode_run_time?.[0] ?? null,
    externalIds: toExternalIds(String(tv.id), tv.external_ids),
    seasons,
  };
}

export function toTvSeason(
  season: {
    season_number: number;
    name?: string | null;
  },
  detail: TmdbSeasonDetails,
): ProviderSeason {
  return {
    number: season.season_number,
    title: season.name ?? null,
    episodes: (detail.episodes ?? []).map((e) => ({
      number: e.episode_number,
      title: e.name ?? null,
      airDate: e.air_date || null,
    })),
  };
}

export function toExtras(
  type: MediaType,
  sourceId: string,
  data: TmdbExtras,
  omdbRatings: RatingDto[],
): MediaExtrasDto {
  const path = type === MediaType.MOVIE ? "movie" : "tv";
  const tmdbRating =
    data.vote_average && data.vote_count
      ? [
          {
            source: "TMDB",
            score: `${data.vote_average.toFixed(1)}/10 (${data.vote_count})`,
            url: `https://www.themoviedb.org/${path}/${sourceId}`,
          },
        ]
      : [];

  const region = data["watch/providers"]?.results?.FR;
  const toProviders = (list?: TmdbWatchProvider[]): WatchProviderDto[] =>
    (list ?? []).map((p) => ({
      name: p.provider_name,
      logoUrl: p.logo_path ? `${IMG}/w92${p.logo_path}` : null,
    }));
  const summarize = (r: TmdbMovieResult & TmdbTvResult): MediaSummaryDto =>
    type === MediaType.MOVIE ? toMovieSummary(r) : toTvSummary(r);

  return {
    watchProviders: {
      flatrate: toProviders(region?.flatrate),
      rent: toProviders(region?.rent),
      buy: toProviders(region?.buy),
      link: region?.link ?? null,
    },
    cast: (data.credits?.cast ?? []).slice(0, 12).map((c) => ({
      id: String(c.id),
      name: c.name,
      role: c.character || null,
      photoUrl: c.profile_path ? `${IMG}/w185${c.profile_path}` : null,
      // Split cast photo is an AniList-only concept (voice actor vs. character).
      characterPhotoUrl: null,
    })),
    similar: (data.recommendations?.results ?? [])
      .slice(0, 12)
      .map((r) => summarize(r as TmdbMovieResult & TmdbTvResult)),
    ratings: [...tmdbRating, ...omdbRatings],
    images: (data.images?.backdrops ?? [])
      .slice(0, MAX_GALLERY_IMAGES)
      .map((b) => `${IMG}/w1280${b.file_path}`),
    tagline: data.tagline?.trim() || null,
    directors: directorNames(type, data),
    trailerVideoId: pickTrailer(data.videos?.results),
    contentRating: certification(type, data),
    // AniList-only fields — TMDB has no studios/format/season/relations/
    // externalLinks/tags equivalent wired up here.
    studios: [],
    format: null,
    season: null,
    relations: [],
    externalLinks: [],
    tags: [],
  };
}

export function toCastDetail(p: TmdbPersonDetails): CastDetailDto {
  // Most-popular, poster-bearing roles first; dedupe repeat titles.
  const seen = new Set<number>();
  const knownFor: MediaSummaryDto[] = (p.combined_credits?.cast ?? [])
    .filter((c) => c.poster_path)
    .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
    .filter((c) => (seen.has(c.id) ? false : seen.add(c.id)))
    .slice(0, 12)
    .map((c) =>
      c.media_type === "movie"
        ? toMovieSummary(c as TmdbMovieResult)
        : toTvSummary(c as TmdbTvResult),
    );

  return {
    name: p.name,
    photoUrl: p.profile_path ? `${IMG}/w185${p.profile_path}` : null,
    subtitle: personSubtitle(p),
    description: p.biography?.trim() || null,
    knownFor,
    imdbId: p.external_ids?.imdb_id || null,
    wikidataId: p.external_ids?.wikidata_id || null,
    homepage: p.homepage?.trim() || null,
  };
}

/** "1985 – 2020 · Tokyo, Japan" from whatever birth/death/place fields exist. */
function personSubtitle(p: TmdbPersonDetails): string | null {
  const birthYear = p.birthday?.slice(0, 4);
  const deathYear = p.deathday?.slice(0, 4);
  const years = birthYear
    ? deathYear
      ? `${birthYear} – ${deathYear}`
      : birthYear
    : null;
  return [years, p.place_of_birth].filter(Boolean).join(" · ") || null;
}

/** "fr" → "fr-FR"; anything else (including unset) → "en-US". */
export function tmdbLanguage(lang: string | undefined): string {
  return lang === "fr" ? "fr-FR" : "en-US";
}

/**
 * Movies: the crew members credited as "Director". Series: TMDB's `credits`
 * append has no reliable per-series director, so the show's own creator(s)
 * (`created_by`, a base field) stand in instead.
 */
function directorNames(type: MediaType, data: TmdbExtras): string[] {
  if (type === MediaType.MOVIE) {
    const names = (data.credits?.crew ?? [])
      .filter((c) => c.job === "Director")
      .map((c) => c.name);
    return [...new Set(names)];
  }

  return (data.created_by ?? []).map((c) => c.name);
}

/** Prefer an official trailer, else any trailer, else nothing. */
function pickTrailer(videos: TmdbVideo[] | undefined): string | null {
  const trailers = (videos ?? []).filter(
    (v) => v.site === "YouTube" && v.type === "Trailer",
  );
  const best = trailers.find((v) => v.official) ?? trailers[0];
  return best?.key ?? null;
}

/** Official certification for France, falling back to the US. */
function certification(type: MediaType, data: TmdbExtras): string | null {
  if (type === MediaType.MOVIE) {
    const byCountry = data.release_dates?.results ?? [];
    const region =
      byCountry.find((r) => r.iso_3166_1 === "FR") ??
      byCountry.find((r) => r.iso_3166_1 === "US");
    const cert = region?.release_dates.find(
      (d) => d.certification,
    )?.certification;
    return cert || null;
  }

  const byCountry = data.content_ratings?.results ?? [];
  const region =
    byCountry.find((r) => r.iso_3166_1 === "FR") ??
    byCountry.find((r) => r.iso_3166_1 === "US");
  return region?.rating || null;
}
