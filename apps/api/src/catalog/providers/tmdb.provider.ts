import type {
  CastDetailDto,
  MediaExtrasDto,
  WatchProviderDto,
} from "@loomkeep/shared";
import {
  CatalogSource,
  MediaSource,
  MediaSummaryDto,
  MediaType,
} from "@loomkeep/shared";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { fetchJson } from "../../common/http.util";
import { QuotaTrackerService } from "../../common/quota-tracker.service";
import { OmdbService } from "../omdb.service";
import type {
  CatalogProvider,
  ProviderExternalId,
  ProviderMediaDetails,
  ProviderSeason,
} from "./provider.types";

const BASE_URL = "https://api.themoviedb.org/3";
// TMDB's terms forbid using its API as an image host — never download/cache
// these and serve them from Loomkeep's own infra. URLs are only ever handed
// to the client, which loads them straight from image.tmdb.org.
const IMG = "https://image.tmdb.org/t/p";

interface TmdbMovieResult {
  id: number;
  title: string;
  original_title?: string;
  release_date?: string;
  poster_path?: string | null;
  adult?: boolean;
}

interface TmdbTvResult {
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

interface TmdbMovieDetails extends TmdbMovieResult {
  overview?: string | null;
  backdrop_path?: string | null;
  genres?: { name: string }[];
  status?: string | null;
  runtime?: number | null;
  external_ids?: TmdbExternalIds;
}

interface TmdbTvDetails extends TmdbTvResult {
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

interface TmdbSeasonDetails {
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

interface TmdbExtras {
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

interface TmdbPersonDetails {
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

interface TmdbFindResult {
  // `/find` returns full objects, so an external-id lookup already carries the
  // metadata needed to display the match — no extra details call.
  tv_results?: TmdbTvResult[];
  movie_results?: TmdbMovieResult[];
}

/** Films and (western) series, from The Movie Database. */
@Injectable()
export class TmdbProvider implements CatalogProvider {
  readonly source = CatalogSource.TMDB;

  constructor(
    private readonly configService: ConfigService,
    private readonly omdb: OmdbService,
    private readonly quota: QuotaTrackerService,
  ) {}

  async search(
    query: string,
    type?: MediaType,
    page = 1,
    lang?: string,
  ): Promise<MediaSummaryDto[]> {
    const wantMovies = type === undefined || type === MediaType.MOVIE;
    const wantSeries = type === undefined || type === MediaType.SERIES;
    // Adult movies are fetched too (flagged via `adult`) — the caller
    // (CatalogController) strips them per-account with the age gate.
    const params = {
      query,
      page: String(page),
      include_adult: "true",
      language: tmdbLanguage(lang),
    };

    const [movies, series] = await Promise.all([
      wantMovies
        ? this.get<{ results: TmdbMovieResult[] }>("/search/movie", params)
        : Promise.resolve({ results: [] }),
      wantSeries
        ? this.get<{ results: TmdbTvResult[] }>("/search/tv", params)
        : Promise.resolve({ results: [] }),
    ]);

    return [
      ...movies.results.map((m) => this.toMovieSummary(m)),
      ...series.results.map((s) => this.toTvSummary(s)),
    ];
  }

  async getDetails(
    sourceId: string,
    type: MediaType,
    lang?: string,
  ): Promise<ProviderMediaDetails> {
    return type === MediaType.MOVIE
      ? this.getMovieDetails(sourceId, lang)
      : this.getTvDetails(sourceId, lang);
  }

  /**
   * Resolve a TheTVDB series id to its TMDB series summary (title, year,
   * poster). Used by the TV Time import, whose shows are identified by TVDB
   * ids. Returns null when TMDB knows no series for that external id.
   */
  async findSeriesSummaryByTvdbId(
    tvdbId: string,
  ): Promise<MediaSummaryDto | null> {
    const found = await this.get<TmdbFindResult>(`/find/${tvdbId}`, {
      external_source: "tvdb_id",
    });
    const tv = found.tv_results?.[0];
    return tv ? this.toTvSummary(tv) : null;
  }

  /**
   * Resolve a TMDB movie id straight to its summary (title, year, poster) —
   * one cheap call, no `append_to_response`. Used by importers that already
   * carry a TMDB id (Trakt) instead of TV Time's TVDB-only reconciliation.
   * Throws {@link NotFoundException} (via `get`) when TMDB has no such id.
   */
  async getMovieSummaryByTmdbId(tmdbId: string): Promise<MediaSummaryDto> {
    const movie = await this.get<TmdbMovieResult>(`/movie/${tmdbId}`, {});
    return this.toMovieSummary(movie);
  }

  /** Series counterpart of {@link getMovieSummaryByTmdbId}. */
  async getSeriesSummaryByTmdbId(tmdbId: string): Promise<MediaSummaryDto> {
    const tv = await this.get<TmdbTvResult>(`/tv/${tmdbId}`, {});
    return this.toTvSummary(tv);
  }

  /** IMDb counterpart of {@link findSeriesSummaryByTvdbId}, for movies. */
  async findMovieSummaryByImdbId(
    imdbId: string,
  ): Promise<MediaSummaryDto | null> {
    const found = await this.get<TmdbFindResult>(`/find/${imdbId}`, {
      external_source: "imdb_id",
    });
    const movie = found.movie_results?.[0];
    return movie ? this.toMovieSummary(movie) : null;
  }

  /** IMDb counterpart of {@link findSeriesSummaryByTvdbId}. */
  async findSeriesSummaryByImdbId(
    imdbId: string,
  ): Promise<MediaSummaryDto | null> {
    const found = await this.get<TmdbFindResult>(`/find/${imdbId}`, {
      external_source: "imdb_id",
    });
    const tv = found.tv_results?.[0];
    return tv ? this.toTvSummary(tv) : null;
  }

  private async getMovieDetails(
    sourceId: string,
    lang?: string,
  ): Promise<ProviderMediaDetails> {
    const movie = await this.get<TmdbMovieDetails>(`/movie/${sourceId}`, {
      append_to_response: "external_ids",
      language: tmdbLanguage(lang),
    });

    return {
      summary: this.toMovieSummary(movie),
      overview: movie.overview ?? null,
      backdropUrl: movie.backdrop_path
        ? `${IMG}/w1280${movie.backdrop_path}`
        : null,
      genres: movie.genres?.map((g) => g.name) ?? [],
      status: movie.status ?? null,
      releaseDate: movie.release_date || null,
      runtimeMin: movie.runtime ?? null,
      externalIds: this.toExternalIds(String(movie.id), movie.external_ids),
      seasons: [],
    };
  }

  private async getTvDetails(
    sourceId: string,
    lang?: string,
  ): Promise<ProviderMediaDetails> {
    const tv = await this.get<TmdbTvDetails>(`/tv/${sourceId}`, {
      append_to_response: "external_ids",
      language: tmdbLanguage(lang),
    });

    // Episode lists live on per-season endpoints.
    const seasons: ProviderSeason[] = await Promise.all(
      (tv.seasons ?? []).map(async (season) => {
        const detail = await this.get<TmdbSeasonDetails>(
          `/tv/${sourceId}/season/${season.season_number}`,
          {},
        );
        return {
          number: season.season_number,
          title: season.name ?? null,
          episodes: (detail.episodes ?? []).map((e) => ({
            number: e.episode_number,
            title: e.name ?? null,
            airDate: e.air_date || null,
          })),
        };
      }),
    );

    return {
      summary: this.toTvSummary(tv),
      overview: tv.overview ?? null,
      backdropUrl: tv.backdrop_path ? `${IMG}/w1280${tv.backdrop_path}` : null,
      genres: tv.genres?.map((g) => g.name) ?? [],
      status: tv.status ?? null,
      releaseDate: tv.first_air_date || null,
      runtimeMin: tv.episode_run_time?.[0] ?? null,
      externalIds: this.toExternalIds(String(tv.id), tv.external_ids),
      seasons,
    };
  }

  /** Live extras (where to watch, cast, similar) in a single append call. */
  async getExtras(
    sourceId: string,
    type: MediaType,
    lang?: string,
  ): Promise<MediaExtrasDto> {
    const path = type === MediaType.MOVIE ? "movie" : "tv";
    // Movie and TV certifications live under different append keys.
    const certificationAppend =
      type === MediaType.MOVIE ? "release_dates" : "content_ratings";
    const data = await this.get<TmdbExtras>(`/${path}/${sourceId}`, {
      append_to_response: `credits,recommendations,watch/providers,external_ids,images,videos,${certificationAppend}`,
      // TMDB's /images endpoint defaults to the request's language, filtering
      // out most backdrops; an empty language keeps the full (unfiltered) set.
      include_image_language: "null",
      language: tmdbLanguage(lang),
    });

    // IMDb / Rotten Tomatoes / Metacritic from OMDb (via the IMDb id).
    const omdbRatings = await this.omdb.getRatings(
      data.external_ids?.imdb_id ?? null,
    );
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
      type === MediaType.MOVIE ? this.toMovieSummary(r) : this.toTvSummary(r);

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

  /** Live detail of a TMDB person for the cast modal. */
  async getPerson(id: string): Promise<CastDetailDto> {
    const p = await this.get<TmdbPersonDetails>(`/person/${id}`, {
      append_to_response: "combined_credits,external_ids",
    });

    // Most-popular, poster-bearing roles first; dedupe repeat titles.
    const seen = new Set<number>();
    const knownFor: MediaSummaryDto[] = (p.combined_credits?.cast ?? [])
      .filter((c) => c.poster_path)
      .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
      .filter((c) => (seen.has(c.id) ? false : seen.add(c.id)))
      .slice(0, 12)
      .map((c) =>
        c.media_type === "movie"
          ? this.toMovieSummary(c as TmdbMovieResult)
          : this.toTvSummary(c as TmdbTvResult),
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

  private toMovieSummary(movie: TmdbMovieResult): MediaSummaryDto {
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

  private toTvSummary(tv: TmdbTvResult): MediaSummaryDto {
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

  private toExternalIds(tmdbId: string, ids?: TmdbExternalIds) {
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

  private async get<T>(
    path: string,
    params: Record<string, string>,
  ): Promise<T> {
    const url = new URL(`${BASE_URL}${path}`);

    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    this.quota.record("tmdb");
    return fetchJson<T>(
      url,
      {
        headers: {
          Authorization: `Bearer ${this.configService.getOrThrow<string>("TMDB_API_TOKEN")}`,
          Accept: "application/json",
        },
      },
      { sourceLabel: "TMDB", notFoundMessage: "Media not found on TMDB" },
    );
  }
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
function tmdbLanguage(lang: string | undefined): string {
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
