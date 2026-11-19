import type {
  CastDetailDto,
  CreatorWorkDto,
  EpisodeMediaDto,
  MediaExtrasDto,
  MediaSagaDto,
  PagedResult,
  PersonPageDto,
  PremiereDto,
  PremiereNetwork,
  SeasonImagesDto,
  StudioPageDto,
  WatchProviderDto,
} from "@loomkeep/shared";
import {
  CatalogSource,
  ErrorCode,
  MediaSummaryDto,
  MediaType,
  PREMIERE_NETWORKS,
  regionalLocale,
  StudioKind,
  StudioWorkOrder,
} from "@loomkeep/shared";
import { HttpStatus, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AppException } from "../../common/app.exception";
import { utcDateKey } from "../../common/date.util";
import { fetchJson } from "../../common/http.util";
import { QuotaTrackerService } from "../../common/quota-tracker.service";
import { OmdbService } from "../omdb.service";
import type {
  CatalogProvider,
  ProviderMediaDetails,
  ProviderSeason,
} from "./provider.types";
import {
  tmdbPosterUrl,
  toCastDetail,
  toEpisodeMedia,
  toExtras,
  toMovieDetails,
  toMovieSagaMember,
  toMovieSummary,
  toPersonPage,
  toPremiere,
  toSeasonImages,
  toStudioPage,
  toStudioWork,
  toTvDetails,
  toTvSeason,
  toTvSummary,
  toWatchProviders,
  type TmdbCollection,
  type TmdbDiscoverPage,
  type TmdbEpisodeMedia,
  type TmdbExtras,
  type TmdbFindResult,
  type TmdbMovieDetails,
  type TmdbMovieResult,
  type TmdbPersonDetails,
  type TmdbPremiereResult,
  type TmdbSeasonDetails,
  type TmdbSeasonImages,
  type TmdbStudio,
  type TmdbTvDetails,
  type TmdbTvResult,
  type TmdbWatchProvider,
} from "./tmdb.mapper";

export const TMDB_API_URL = "https://api.themoviedb.org/3";

// Discover's "popularity" follows this week's trend: an A24 page would open
// on its latest releases. The vote count reads as how known a title is.
const STUDIO_SORT: Record<StudioWorkOrder, Record<"movie" | "tv", string>> = {
  known: { movie: "vote_count.desc", tv: "vote_count.desc" },
  newest: { movie: "primary_release_date.desc", tv: "first_air_date.desc" },
  oldest: { movie: "primary_release_date.asc", tv: "first_air_date.asc" },
};
// Discover serves no page past 500.
const DISCOVER_MAX_PAGE = 500;
const STUDIO_KNOWN_FOR = 4;

// The provider lists barely move: a day-old copy spares two TMDB calls each
// time someone opens their services settings.
const WATCH_LIST_TTL_MS = 24 * 60 * 60 * 1000;

const GALLERY_TTL_MS = 6 * 60 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;
// Eight weeks of premieres; TMDB dates the further ones as they get announced.
const PREMIERE_DAYS = 57;
const PREMIERE_TTL_MS = 6 * 60 * 60 * 1000;
// A network airs a few premieres a week: three pages of 20 cover eight weeks.
const PREMIERE_MAX_PAGES = 3;
const GALLERY_CACHE_SIZE = 500;

// The Academy's definition of a short film.
const SHORT_FILM_MAX_MINUTES = 40;
// 20 films a page: past 100 shorts the rest stay listed as works.
const SHORT_FILM_MAX_PAGES = 5;

/** Films and (western) series, from The Movie Database. */
@Injectable()
export class TmdbProvider implements CatalogProvider {
  readonly source = CatalogSource.TMDB;

  // Episode and season galleries barely move either, and a panel tends to
  // be reopened while browsing a season.
  private readonly galleries = new Map<
    string,
    { fetchedAt: number; media: EpisodeMediaDto | SeasonImagesDto }
  >();

  private readonly watchProviderLists = new Map<
    string,
    { fetchedAt: number; providers: WatchProviderDto[] }
  >();

  private watchRegions: { fetchedAt: number; codes: string[] } | null = null;
  private readonly premieres = new Map<
    string,
    { fetchedAt: number; items: PremiereDto[] }
  >();

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
    // A `sourceId` like "1/../account" would reach another TMDB endpoint
    // with our token, as the saga and person lookups already guard against.
    assertTmdbId(sourceId, ErrorCode.CatalogItemNotFound);
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
    // From an uploaded export, like the IMDb ids below.
    if (!/^\d+$/.test(tvdbId)) return null;
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
    return (await this.findByImdbId(imdbId)).movie;
  }

  /** IMDb counterpart of {@link findSeriesSummaryByTvdbId}. */
  async findSeriesSummaryByImdbId(
    imdbId: string,
  ): Promise<MediaSummaryDto | null> {
    return (await this.findByImdbId(imdbId)).series;
  }

  /**
   * Everything TMDB files under an IMDb id, in one call: a film, a series, or
   * an episode with the series it belongs to and its position. An IMDb export
   * types its rows, but TMDB does not always agree (a TV special can be an
   * episode there), so the caller routes on what actually came back.
   */
  async findByImdbId(imdbId: string): Promise<{
    movie: MediaSummaryDto | null;
    series: MediaSummaryDto | null;
    episode: { seriesTmdbId: string; season: number; episode: number } | null;
  }> {
    // The id comes from an uploaded file: anything else could reach another
    // TMDB endpoint with our token.
    if (!/^tt\d+$/.test(imdbId)) {
      return { movie: null, series: null, episode: null };
    }

    const found = await this.get<TmdbFindResult>(`/find/${imdbId}`, {
      external_source: "imdb_id",
    });
    const movie = found.movie_results?.[0];
    const series = found.tv_results?.[0];
    const episode = found.tv_episode_results?.[0];

    return {
      movie: movie ? toMovieSummary(movie) : null,
      series: series ? toTvSummary(series) : null,
      episode: episode
        ? {
            seriesTmdbId: String(episode.show_id),
            season: episode.season_number,
            episode: episode.episode_number,
          }
        : null,
    };
  }

  /** The collection a film belongs to, in release order. Null when none. */
  async getSaga(sourceId: string, lang?: string): Promise<MediaSagaDto | null> {
    // The id comes straight from the page's URL: anything but digits could
    // reach another TMDB endpoint with our token.
    if (!/^\d+$/.test(sourceId)) return null;
    const language = regionalLocale(lang);
    const movie = await this.get<TmdbMovieDetails>(`/movie/${sourceId}`, {
      language,
    });
    const collectionId = movie.belongs_to_collection?.id;
    if (!collectionId) return null;

    return this.getCollection(String(collectionId), lang);
  }

  /** A collection's films in release order. Null under two films. */
  async getCollection(
    collectionId: string,
    lang?: string,
  ): Promise<MediaSagaDto | null> {
    if (!/^\d+$/.test(collectionId)) return null;
    const collection = await this.get<TmdbCollection>(
      `/collection/${collectionId}`,
      { language: regionalLocale(lang) },
    );
    const today = utcDateKey(new Date());
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

    // Episode lists live on per-season endpoints. Same language as the show
    // itself, so a translation fetch also brings episode titles/synopses.
    const seasons: ProviderSeason[] = await Promise.all(
      (tv.seasons ?? []).map(async (season) => {
        const detail = await this.get<TmdbSeasonDetails>(
          `/tv/${sourceId}/season/${season.season_number}`,
          { language: regionalLocale(lang) },
        );
        return toTvSeason(season, detail);
      }),
    );

    return toTvDetails(tv, seasons);
  }

  /**
   * One episode's stills and videos, live (one call per episode, so only
   * when its side panel opens). Images are requested in every language:
   * stills carry no text, and a language filter drops most of them.
   */
  getEpisodeMedia(
    sourceId: string,
    seasonNumber: number,
    episodeNumber: number,
    lang?: string,
  ): Promise<EpisodeMediaDto> {
    return this.cachedGallery(
      `episode:${sourceId}:${seasonNumber}:${episodeNumber}:${lang ?? ""}`,
      async () =>
        toEpisodeMedia(
          await this.get<TmdbEpisodeMedia>(
            `/tv/${sourceId}/season/${seasonNumber}/episode/${episodeNumber}`,
            {
              append_to_response: "images,videos",
              include_image_language: "null",
              include_video_language: `${lang ?? "en"},en,null`,
              language: regionalLocale(lang),
            },
          ),
        ),
    );
  }

  /**
   * A season's posters, live, for its lightbox. Posters carry their title,
   * so the viewer's language comes first, then English and textless ones.
   */
  getSeasonImages(
    sourceId: string,
    seasonNumber: number,
    lang?: string,
  ): Promise<SeasonImagesDto> {
    return this.cachedGallery(
      `season:${sourceId}:${seasonNumber}:${lang ?? ""}`,
      async () =>
        toSeasonImages(
          await this.get<TmdbSeasonImages>(
            `/tv/${sourceId}/season/${seasonNumber}/images`,
            { include_image_language: `${lang ?? "en"},en,null` },
          ),
        ),
    );
  }

  private async cachedGallery<T extends EpisodeMediaDto | SeasonImagesDto>(
    key: string,
    fetch: () => Promise<T>,
  ): Promise<T> {
    const cached = this.galleries.get(key);

    if (cached && Date.now() - cached.fetchedAt < GALLERY_TTL_MS) {
      return cached.media as T;
    }

    const media = await fetch();
    // Oldest entry out first (a Map iterates in insertion order).
    this.galleries.delete(key);
    this.galleries.set(key, { fetchedAt: Date.now(), media });

    if (this.galleries.size > GALLERY_CACHE_SIZE) {
      this.galleries.delete(this.galleries.keys().next().value!);
    }

    return media;
  }

  /** Live extras (where to watch, cast, similar) in a single append call. */
  async getExtras(
    sourceId: string,
    type: MediaType,
    lang: string | undefined,
    watchRegion: string,
  ): Promise<MediaExtrasDto> {
    assertTmdbId(sourceId, ErrorCode.CatalogItemNotFound);
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
    assertTmdbId(id, ErrorCode.CatalogPersonNotFound);
    const p = await this.get<TmdbPersonDetails>(`/person/${id}`, {
      append_to_response: "combined_credits,external_ids",
    });

    return toCastDetail(p);
  }

  /**
   * A person's page: identity and every film and series credit, titles and
   * biography in `lang`. TMDB doesn't fall back to English for a missing
   * translated biography, so a second, lighter call fetches it then.
   */
  async getPersonPage(id: string, lang?: string): Promise<PersonPageDto> {
    // The id comes straight from the page's URL: anything but digits could
    // reach another TMDB endpoint with our token.
    if (!/^\d+$/.test(id)) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.CatalogPersonNotFound,
        undefined,
        `Not a TMDB person id: ${id}`,
      );
    }

    const language = regionalLocale(lang);
    const [person, shortFilmIds] = await Promise.all([
      this.get<TmdbPersonDetails>(`/person/${id}`, {
        append_to_response: "combined_credits,external_ids",
        language,
      }),
      this.shortFilmIds(id),
    ]);

    if (!person.biography?.trim() && !language.startsWith("en")) {
      const english = await this.get<TmdbPersonDetails>(`/person/${id}`, {
        language: "en-US",
      }).catch(() => null);
      person.biography = english?.biography ?? null;
    }

    return toPersonPage(person, utcDateKey(new Date()), shortFilmIds);
  }

  /**
   * The person's films of 40 minutes or less. Their credits carry no
   * runtime, and Discover filters on it across all their films at once,
   * where reading each film would cost one call per credit.
   */
  private async shortFilmIds(personId: string): Promise<Set<string>> {
    type Page = { results: { id: number }[]; total_pages: number };
    const page = (n: number) =>
      this.get<Page>("/discover/movie", {
        with_people: personId,
        "with_runtime.gte": "1",
        "with_runtime.lte": String(SHORT_FILM_MAX_MINUTES),
        include_adult: "true",
        page: String(n),
      });

    const first = await page(1);
    const lastPage = Math.min(first.total_pages, SHORT_FILM_MAX_PAGES);
    const rest = await Promise.all(
      Array.from({ length: lastPage - 1 }, (_, i) => page(i + 2)),
    );
    return new Set(
      [first, ...rest].flatMap((p) => p.results.map((m) => String(m.id))),
    );
  }

  /** A production company's or a network's identity, with how many titles each type has. */
  async getStudioPage(
    kind: StudioKind,
    id: string,
    lang?: string,
  ): Promise<StudioPageDto> {
    assertTmdbId(id);
    const language = regionalLocale(lang);
    const [studio, movies, series] = await Promise.all([
      this.get<TmdbStudio>(
        `/${kind === StudioKind.COMPANY ? "company" : "network"}/${id}`,
        {},
      ),
      kind === StudioKind.COMPANY
        ? this.discoverStudio(kind, id, MediaType.MOVIE, "known", 1, language)
        : null,
      this.discoverStudio(kind, id, MediaType.SERIES, "known", 1, language),
    ]);
    const today = utcDateKey(new Date());
    const main =
      (movies?.total_results ?? 0) >= series.total_results
        ? { page: movies, type: MediaType.MOVIE }
        : { page: series, type: MediaType.SERIES };

    return toStudioPage(
      kind,
      studio,
      {
        movies: movies?.total_results ?? 0,
        series: series.total_results,
      },
      (main.page?.results ?? [])
        .slice(0, STUDIO_KNOWN_FOR)
        .map((r) => toStudioWork(r, main.type, today)),
    );
  }

  /** One page of a studio's films or series, 20 at a time as Discover serves them. */
  async getStudioWorks(
    kind: StudioKind,
    id: string,
    type: MediaType,
    order: StudioWorkOrder,
    page: number,
    lang?: string,
  ): Promise<PagedResult<CreatorWorkDto>> {
    assertTmdbId(id);

    // A network airs series only.
    if (kind === StudioKind.NETWORK && type === MediaType.MOVIE) {
      return { items: [], hasMore: false, total: 0 };
    }

    const data = await this.discoverStudio(
      kind,
      id,
      type,
      order,
      Math.min(page, DISCOVER_MAX_PAGE),
      regionalLocale(lang),
    );
    const today = utcDateKey(new Date());
    return {
      items: data.results.map((r) => toStudioWork(r, type, today)),
      hasMore: data.page < Math.min(data.total_pages, DISCOVER_MAX_PAGE),
      total: data.total_results,
    };
  }

  private discoverStudio(
    kind: StudioKind,
    id: string,
    type: MediaType,
    order: StudioWorkOrder,
    page: number,
    language: string,
  ) {
    const media = type === MediaType.MOVIE ? "movie" : "tv";
    return this.get<TmdbDiscoverPage<TmdbMovieResult & TmdbTvResult>>(
      `/discover/${media}`,
      {
        [kind === StudioKind.COMPANY ? "with_companies" : "with_networks"]: id,
        sort_by: STUDIO_SORT[order][media],
        include_adult: "false",
        page: String(page),
        language,
      },
    );
  }

  /**
   * Series whose first episode airs from yesterday (the viewer's day may
   * still be UTC's previous one) to eight weeks out, soonest first. The list
   * is the same for everyone reading a language, so it is shared and cached.
   */
  async listPremieres(lang?: string, now = new Date()): Promise<PremiereDto[]> {
    const language = regionalLocale(lang);
    const from = utcDateKey(new Date(now.getTime() - DAY_MS));
    const key = `${language}|${from}`;
    const cached = this.premieres.get(key);

    if (cached && now.getTime() - cached.fetchedAt < PREMIERE_TTL_MS) {
      return cached.items;
    }

    const to = utcDateKey(new Date(now.getTime() + PREMIERE_DAYS * DAY_MS));
    const perNetwork = await Promise.all(
      PREMIERE_NETWORKS.map((network) =>
        this.discoverPremieres(network, from, to, language),
      ),
    );
    // A series on two listed networks keeps the first one of the list,
    // which puts the worldwide streamers ahead of their partners.
    const seen = new Set<string>();
    const items = perNetwork
      .flat()
      .filter((p) => !seen.has(p.sourceId) && seen.add(p.sourceId))
      .sort(
        (a, b) =>
          a.firstAirDate.localeCompare(b.firstAirDate) ||
          b.popularity - a.popularity,
      );

    // Yesterday's lists are stale for good: drop them rather than let the
    // map grow by one key per day and language.
    for (const [k, entry] of this.premieres) {
      if (now.getTime() - entry.fetchedAt >= PREMIERE_TTL_MS) {
        this.premieres.delete(k);
      }
    }

    this.premieres.set(key, { fetchedAt: now.getTime(), items });
    return items;
  }

  private async discoverPremieres(
    network: PremiereNetwork,
    from: string,
    to: string,
    language: string,
  ): Promise<PremiereDto[]> {
    const premieres: PremiereDto[] = [];

    for (let page = 1; page <= PREMIERE_MAX_PAGES; page++) {
      const data = await this.get<TmdbDiscoverPage<TmdbPremiereResult>>(
        "/discover/tv",
        {
          with_networks: String(network.id),
          "first_air_date.gte": from,
          "first_air_date.lte": to,
          // Scripted and miniseries: no talk, news nor reality shows.
          with_type: "2|4",
          sort_by: "first_air_date.asc",
          include_adult: "false",
          include_null_first_air_dates: "false",
          language,
          page: String(page),
        },
      );

      for (const result of data.results) {
        const premiere = toPremiere(result, network);
        if (premiere) premieres.push(premiere);
      }

      if (page >= data.total_pages) break;
    }

    return premieres;
  }

  /** This week's trending films and series, adult titles left out. */
  async trendingPosters(): Promise<string[]> {
    const pages = await Promise.all(
      ["1", "2"].map((page) =>
        this.get<{
          results: {
            media_type?: string;
            adult?: boolean;
            poster_path?: string | null;
          }[];
        }>("/trending/all/week", { page }),
      ),
    );
    return pages
      .flatMap((data) => data.results)
      .flatMap((r) =>
        (r.media_type === "movie" || r.media_type === "tv") &&
        !r.adult &&
        r.poster_path
          ? [tmdbPosterUrl(r.poster_path)]
          : [],
      );
  }

  private async get<T>(
    path: string,
    params: Record<string, string>,
  ): Promise<T> {
    const url = new URL(`${TMDB_API_URL}${path}`);

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

/** An id from a page's URL, interpolated into a TMDB path: digits only. */
function assertTmdbId(id: string): void {
  if (!/^\d+$/.test(id)) {
    throw new AppException(
      HttpStatus.NOT_FOUND,
      ErrorCode.CatalogStudioNotFound,
      undefined,
      `Not a TMDB id: ${id}`,
    );
  }
}
