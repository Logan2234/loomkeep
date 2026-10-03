import type {
  CastDetailDto,
  MediaExtrasDto,
  MediaSagaDto,
  WatchProviderDto,
} from "@loomkeep/shared";
import {
  CatalogSource,
  MediaSummaryDto,
  MediaType,
  regionalLocale,
} from "@loomkeep/shared";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { fetchJson } from "../../common/http.util";
import { QuotaTrackerService } from "../../common/quota-tracker.service";
import { OmdbService } from "../omdb.service";
import type {
  CatalogProvider,
  ProviderMediaDetails,
  ProviderSeason,
} from "./provider.types";
import {
  toCastDetail,
  toExtras,
  toMovieDetails,
  toMovieSagaMember,
  toMovieSummary,
  toTvDetails,
  toTvSeason,
  toTvSummary,
  toWatchProviders,
  type TmdbCollection,
  type TmdbExtras,
  type TmdbFindResult,
  type TmdbMovieDetails,
  type TmdbMovieResult,
  type TmdbPersonDetails,
  type TmdbSeasonDetails,
  type TmdbTvDetails,
  type TmdbTvResult,
  type TmdbWatchProvider,
} from "./tmdb.mapper";

const BASE_URL = "https://api.themoviedb.org/3";

// The provider lists barely move: a day-old copy spares two TMDB calls each
// time someone opens their services settings.
const WATCH_LIST_TTL_MS = 24 * 60 * 60 * 1000;

/** Films and (western) series, from The Movie Database. */
@Injectable()
export class TmdbProvider implements CatalogProvider {
  readonly source = CatalogSource.TMDB;

  private readonly watchProviderLists = new Map<
    string,
    { fetchedAt: number; providers: WatchProviderDto[] }
  >();

  private watchRegions: { fetchedAt: number; codes: string[] } | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly omdb: OmdbService,
    private readonly quota: QuotaTrackerService,
  ) {}

  /** Every provider JustWatch lists in a region, the most used there first. */
  async listWatchProviders(region: string): Promise<WatchProviderDto[]> {
    const cached = this.watchProviderLists.get(region);

    if (cached && Date.now() - cached.fetchedAt < WATCH_LIST_TTL_MS) {
      return cached.providers;
    }

    // Films and series have a list each: some services only carry one kind.
    const [movie, tv] = await Promise.all(
      ["movie", "tv"].map((kind) =>
        this.get<{ results?: TmdbWatchProvider[] }>(
          `/watch/providers/${kind}`,
          { watch_region: region },
        ),
      ),
    );
    const byId = new Map<number, TmdbWatchProvider>();

    for (const provider of [...(movie.results ?? []), ...(tv.results ?? [])]) {
      byId.set(provider.provider_id, provider);
    }

    const rank = (p: TmdbWatchProvider) =>
      p.display_priorities?.[region] ??
      p.display_priority ??
      Number.MAX_SAFE_INTEGER;
    const providers = toWatchProviders(
      [...byId.values()].sort((a, b) => rank(a) - rank(b)),
    );

    this.watchProviderLists.set(region, { fetchedAt: Date.now(), providers });
    return providers;
  }

  /** ISO 3166-1 codes of the countries JustWatch covers. */
  async listWatchRegions(): Promise<string[]> {
    if (
      this.watchRegions &&
      Date.now() - this.watchRegions.fetchedAt < WATCH_LIST_TTL_MS
    ) {
      return this.watchRegions.codes;
    }

    const data = await this.get<{ results?: { iso_3166_1: string }[] }>(
      "/watch/providers/regions",
      {},
    );
    const codes = (data.results ?? []).map((r) => r.iso_3166_1);

    this.watchRegions = { fetchedAt: Date.now(), codes };
    return codes;
  }

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
      language: regionalLocale(lang),
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
      ...movies.results.map((m) => toMovieSummary(m)),
      ...series.results.map((s) => toTvSummary(s)),
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
    return tv ? toTvSummary(tv) : null;
  }

  /**
   * Resolve a TMDB movie id straight to its summary (title, year, poster) —
   * one cheap call, no `append_to_response`. Used by importers that already
   * carry a TMDB id (Trakt) instead of TV Time's TVDB-only reconciliation.
   * Throws {@link NotFoundException} (via `get`) when TMDB has no such id.
   */
  async getMovieSummaryByTmdbId(tmdbId: string): Promise<MediaSummaryDto> {
    const movie = await this.get<TmdbMovieResult>(`/movie/${tmdbId}`, {});
    return toMovieSummary(movie);
  }

  /** Series counterpart of {@link getMovieSummaryByTmdbId}. */
  async getSeriesSummaryByTmdbId(tmdbId: string): Promise<MediaSummaryDto> {
    const tv = await this.get<TmdbTvResult>(`/tv/${tmdbId}`, {});
    return toTvSummary(tv);
  }

  /** IMDb counterpart of {@link findSeriesSummaryByTvdbId}, for movies. */
  async findMovieSummaryByImdbId(
    imdbId: string,
  ): Promise<MediaSummaryDto | null> {
    const found = await this.get<TmdbFindResult>(`/find/${imdbId}`, {
      external_source: "imdb_id",
    });
    const movie = found.movie_results?.[0];
    return movie ? toMovieSummary(movie) : null;
  }

  /** IMDb counterpart of {@link findSeriesSummaryByTvdbId}. */
  async findSeriesSummaryByImdbId(
    imdbId: string,
  ): Promise<MediaSummaryDto | null> {
    const found = await this.get<TmdbFindResult>(`/find/${imdbId}`, {
      external_source: "imdb_id",
    });
    const tv = found.tv_results?.[0];
    return tv ? toTvSummary(tv) : null;
  }

  /** The collection a film belongs to, in release order. Null when none. */
  async getSaga(sourceId: string, lang?: string): Promise<MediaSagaDto | null> {
    const language = regionalLocale(lang);
    const movie = await this.get<TmdbMovieDetails>(`/movie/${sourceId}`, {
      language,
    });
    const collectionId = movie.belongs_to_collection?.id;
    if (!collectionId) return null;

    const collection = await this.get<TmdbCollection>(
      `/collection/${collectionId}`,
      { language },
    );
    const today = new Date().toISOString().slice(0, 10);
    const members = (collection.parts ?? [])
      .map((part) => toMovieSagaMember(part, today))
      .sort(byRelease);
    if (members.length < 2) return null;

    return { key: `TMDB:${collection.id}`, title: collection.name, members };
  }

  private async getMovieDetails(
    sourceId: string,
    lang?: string,
  ): Promise<ProviderMediaDetails> {
    const movie = await this.get<TmdbMovieDetails>(`/movie/${sourceId}`, {
      append_to_response: "external_ids,release_dates",
      language: regionalLocale(lang),
    });

    return toMovieDetails(movie);
  }

  private async getTvDetails(
    sourceId: string,
    lang?: string,
  ): Promise<ProviderMediaDetails> {
    const tv = await this.get<TmdbTvDetails>(`/tv/${sourceId}`, {
      append_to_response: "external_ids",
      language: regionalLocale(lang),
    });

    // Episode lists live on per-season endpoints.
    const seasons: ProviderSeason[] = await Promise.all(
      (tv.seasons ?? []).map(async (season) => {
        const detail = await this.get<TmdbSeasonDetails>(
          `/tv/${sourceId}/season/${season.season_number}`,
          {},
        );
        return toTvSeason(season, detail);
      }),
    );

    return toTvDetails(tv, seasons);
  }

  /** Live extras (where to watch, cast, similar) in a single append call. */
  async getExtras(
    sourceId: string,
    type: MediaType,
    lang: string | undefined,
    watchRegion: string,
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
      language: regionalLocale(lang),
    });

    // IMDb / Rotten Tomatoes / Metacritic from OMDb (via the IMDb id).
    const omdbRatings = await this.omdb.getRatings(
      data.external_ids?.imdb_id ?? null,
    );

    return toExtras(type, sourceId, data, omdbRatings, watchRegion);
  }

  /** Live detail of a TMDB person for the cast modal. */
  async getPerson(id: string): Promise<CastDetailDto> {
    const p = await this.get<TmdbPersonDetails>(`/person/${id}`, {
      append_to_response: "combined_credits,external_ids",
    });

    return toCastDetail(p);
  }

  private async get<T>(
    path: string,
    params: Record<string, string>,
  ): Promise<T> {
    const url = new URL(`${BASE_URL}${path}`);

    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    return fetchJson<T>(
      url,
      {
        headers: {
          Authorization: `Bearer ${this.configService.getOrThrow<string>("TMDB_API_TOKEN")}`,
          Accept: "application/json",
        },
      },
      {
        sourceLabel: "TMDB",
        notFoundMessage: "Media not found on TMDB",
        onAttempt: () => this.quota.record("tmdb"),
      },
    );
  }
}

// Oldest first; a film with no date yet is an announcement and goes last.
function byRelease(
  a: { releaseDate: string | null },
  b: { releaseDate: string | null },
): number {
  if (a.releaseDate === b.releaseDate) return 0;
  if (!a.releaseDate) return 1;
  if (!b.releaseDate) return -1;
  return a.releaseDate < b.releaseDate ? -1 : 1;
}
