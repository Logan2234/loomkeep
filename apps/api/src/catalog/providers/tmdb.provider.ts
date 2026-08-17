import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
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
  credits?: {
    cast?: {
      id: number;
      name: string;
      character?: string;
      profile_path?: string | null;
    }[];
  };
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
  ): Promise<MediaSummaryDto[]> {
    const wantMovies = type === undefined || type === MediaType.MOVIE;
    const wantSeries = type === undefined || type === MediaType.SERIES;
    // Adult movies are fetched too (flagged via `adult`) — the caller
    // (CatalogController) strips them per-account with the age gate.
    const params = { query, page: String(page), include_adult: "true" };

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
  ): Promise<ProviderMediaDetails> {
    return type === MediaType.MOVIE
      ? this.getMovieDetails(sourceId)
      : this.getTvDetails(sourceId);
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
  ): Promise<ProviderMediaDetails> {
    const movie = await this.get<TmdbMovieDetails>(`/movie/${sourceId}`, {
      append_to_response: "external_ids",
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

  private async getTvDetails(sourceId: string): Promise<ProviderMediaDetails> {
    const tv = await this.get<TmdbTvDetails>(`/tv/${sourceId}`, {
      append_to_response: "external_ids",
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
  async getExtras(sourceId: string, type: MediaType): Promise<MediaExtrasDto> {
    const path = type === MediaType.MOVIE ? "movie" : "tv";
    const data = await this.get<TmdbExtras>(`/${path}/${sourceId}`, {
      append_to_response:
        "credits,recommendations,watch/providers,external_ids,images",
      // TMDB's /images endpoint defaults to the request's language, filtering
      // out most backdrops; an empty language keeps the full (unfiltered) set.
      include_image_language: "null",
    });

    // IMDb / Rotten Tomatoes / Metacritic from OMDb (via the IMDb id).
    const ratings = await this.omdb.getRatings(
      data.external_ids?.imdb_id ?? null,
    );

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
      })),
      similar: (data.recommendations?.results ?? [])
        .slice(0, 12)
        .map((r) => summarize(r as TmdbMovieResult & TmdbTvResult)),
      ratings,
      images: (data.images?.backdrops ?? [])
        .slice(0, MAX_GALLERY_IMAGES)
        .map((b) => `${IMG}/w1280${b.file_path}`),
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
