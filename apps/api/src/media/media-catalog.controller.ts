import { ErrorCode } from "@loomkeep/shared/catalog";
import {
  CastDetailDto,
  EpisodeMediaDto,
  MediaExtrasDto,
  PremiereDto,
  SearchResponseDto,
  SeasonImagesDto,
  WatchProviderCatalogDto,
} from "@loomkeep/shared/contracts";
import { CatalogSource, Domain, MediaType } from "@loomkeep/shared/enums";
import {
  Controller,
  Get,
  Headers,
  HttpStatus,
  Logger,
  Param,
  ParseIntPipe,
  Query,
} from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import type { JwtPayload } from "../auth/decorators/current-user.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AppException } from "../common/app.exception";
import { PagedResponseDto } from "../common/dto/paged-response.dto";
import { safeLang } from "../common/locale.util";
import { parseEnumParam } from "../common/parse-enum-param.util";
import { AgeGateService } from "../users/age-gate.service";
import { filterAdultContent } from "../users/age.util";
import { DomainGated } from "../users/domain-gate.guard";
import { CastDetailResponseDto } from "./dto/cast-detail-response.dto";
import { EpisodeMediaResponseDto } from "./dto/episode-media-response.dto";
import { MediaExtrasResponseDto } from "./dto/media-extras-response.dto";
import { MediaSummaryResponseDto } from "./dto/media-summary-response.dto";
import { PremiereResponseDto } from "./dto/premiere-response.dto";
import { SearchQueryDto } from "./dto/search-query.dto";
import { SeasonImagesResponseDto } from "./dto/season-images-response.dto";
import { WatchProviderCatalogResponseDto } from "./dto/watch-provider-catalog-response.dto";
import { MediaItemService } from "./media-item.service";
import { TmdbProvider } from "./providers/tmdb.provider";
import { rankBySearchRelevance } from "./search-ranking";
import { resolveWatchRegion } from "./watch-region.util";

@DomainGated(Domain.MEDIA)
@Controller("media")
export class MediaCatalogController {
  private readonly logger = new Logger(MediaCatalogController.name);

  constructor(
    private readonly mediaItemService: MediaItemService,
    private readonly ageGate: AgeGateService,
    private readonly tmdb: TmdbProvider,
  ) {}

  /**
   * Every watch provider of a region, for picking one's own services. The
   * region is the one asked for, else the automatic one — returned, so the
   * settings can say which it is.
   */
  @Get("watch-providers")
  @ApiOkResponse({ type: WatchProviderCatalogResponseDto })
  async getWatchProviders(
    @Query("region") region?: string,
    @Headers("accept-language") acceptLanguage?: string,
  ): Promise<WatchProviderCatalogDto> {
    const resolved = resolveWatchRegion(region, acceptLanguage);
    const [regions, providers] = await Promise.all([
      this.tmdb.listWatchRegions(),
      this.tmdb.listWatchProviders(resolved),
    ]);
    return { region: resolved, regions, providers };
  }

  /**
   * Series premiering over the next eight weeks on the networks the calendar
   * follows (`PREMIERE_NETWORKS`), soonest first. Shared by every user
   * reading the same language, so cached for the instance.
   */
  @Get("premieres")
  @ApiOkResponse({ type: [PremiereResponseDto] })
  async getPremieres(
    @CurrentUser() user: JwtPayload,
    @Query("lang") lang?: string,
  ): Promise<PremiereDto[]> {
    return this.tmdb.listPremieres(safeLang(lang));
  }

  /**
   * Live search. ANIME goes to AniList, MOVIE/SERIES to TMDB; without a type
   * filter both sources are queried and merged. 18+ titles are stripped
   * unless the account opted in and is confirmed 18+.
   */
  @Get("search")
  @ApiOkResponse({ type: PagedResponseDto(MediaSummaryResponseDto) })
  async search(
    @CurrentUser() user: JwtPayload,
    @Query() query: SearchQueryDto,
  ): Promise<SearchResponseDto> {
    const wantTmdb = query.type === undefined || query.type !== MediaType.ANIME;
    const wantAnilist =
      query.type === undefined || query.type === MediaType.ANIME;
    const page = query.page ?? 1;

    const [tmdbResults, anilistResults, allowAdult] = await Promise.all([
      wantTmdb
        ? this.mediaItemService
            .providerFor(CatalogSource.TMDB)
            .search(query.q, query.type, page, query.lang)
            .catch((err) => this.searchFailed("TMDB", err))
        : Promise.resolve([]),
      wantAnilist
        ? this.mediaItemService
            .providerFor(CatalogSource.ANILIST)
            .search(query.q, undefined, page)
            .catch((err) => this.searchFailed("AniList", err))
        : Promise.resolve([]),
      this.ageGate.allowsAdultContent(user.sub),
    ]);

    // Each source returns its own popularity order, but concatenating movies +
    // series + anime buries the searched title. Re-rank by title relevance so
    // the actual match floats to the top (ties keep the source order).
    const results = [...anilistResults, ...tmdbResults];
    const items = filterAdultContent(
      rankBySearchRelevance(results, query.q),
      allowAdult,
    );

    // Neither provider reports a total, so "more" just means this page
    // wasn't empty — matches how a provider's own pagination ends (an empty
    // page). Read before the 18+ filter: a page it empties entirely is not
    // the end of the results.
    return { items, hasMore: results.length > 0 };
  }

  /** One source down still leaves the other's results; the log tells it from "no match". */
  private searchFailed(source: string, err: unknown): [] {
    this.logger.warn(`${source} search failed`, err);
    return [];
  }

  /** Live detail of a cast entity (TMDB person, or AniList staff) for the media-page modal. */
  @Get(":source/person/:id")
  @ApiOkResponse({ type: CastDetailResponseDto })
  async getPerson(
    @CurrentUser() user: JwtPayload,
    @Param("source") sourceParam: string,
    @Param("id") id: string,
  ): Promise<CastDetailDto> {
    const source = parseSource(sourceParam);
    const provider = this.mediaItemService.providerFor(source);

    if (!provider.getPerson) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.CatalogNoPersonDetails,
        { source },
        `${source} has no person details`,
      );
    }

    const detail = await provider.getPerson(id);
    const allowAdult = await this.ageGate.allowsAdultContent(user.sub);
    return {
      ...detail,
      knownFor: filterAdultContent(detail.knownFor, allowAdult),
    };
  }

  /**
   * A series episode's stills and videos (TMDB), live and briefly cached —
   * one TMDB call per episode, so only fetched when its side panel opens.
   */
  @Get("tmdb/:id/seasons/:season/episodes/:episode/media")
  @ApiOkResponse({ type: EpisodeMediaResponseDto })
  async getEpisodeMedia(
    // All three are numbers on TMDB: parsed as such, nothing else from the
    // URL can reach the TMDB request path.
    @Param("id", ParseIntPipe) id: number,
    @Param("season", ParseIntPipe) season: number,
    @Param("episode", ParseIntPipe) episode: number,
    @Query("lang") lang?: string,
  ): Promise<EpisodeMediaDto> {
    return this.tmdb.getEpisodeMedia(
      String(id),
      season,
      episode,
      safeLang(lang),
    );
  }

  /** A series season's posters (TMDB), live and briefly cached, for its lightbox. */
  @Get("tmdb/:id/seasons/:season/images")
  @ApiOkResponse({ type: SeasonImagesResponseDto })
  async getSeasonImages(
    @Param("id", ParseIntPipe) id: number,
    @Param("season", ParseIntPipe) season: number,
    @Query("lang") lang?: string,
  ): Promise<SeasonImagesDto> {
    return this.tmdb.getSeasonImages(String(id), season, safeLang(lang));
  }

  /** Live extras (where to watch, cast, similar) — nothing is persisted. */
  @Get(":source/:id/extras")
  @ApiOkResponse({ type: MediaExtrasResponseDto })
  async getExtras(
    @CurrentUser() user: JwtPayload,
    @Param("source") sourceParam: string,
    @Param("id") id: string,
    @Query("type") type?: MediaType,
    @Query("lang") lang?: string,
    @Query("region") region?: string,
    @Headers("accept-language") acceptLanguage?: string,
  ): Promise<MediaExtrasDto> {
    const source = parseSource(sourceParam);
    const resolvedType = resolveType(source, type);
    const extras = await this.mediaItemService
      .providerFor(source)
      .getExtras(
        id,
        resolvedType,
        safeLang(lang),
        resolveWatchRegion(region, acceptLanguage),
      );
    const allowAdult = await this.ageGate.allowsAdultContent(user.sub);
    return {
      ...extras,
      similar: filterAdultContent(extras.similar, allowAdult),
    };
  }
}

function parseSource(value: string): CatalogSource {
  return parseEnumParam(
    value,
    [CatalogSource.TMDB, CatalogSource.ANILIST],
    "catalog source",
  );
}

/** AniList only serves anime; TMDB needs the caller to disambiguate movie vs series. */
function resolveType(source: CatalogSource, type?: MediaType): MediaType {
  if (source === CatalogSource.ANILIST) {
    return MediaType.ANIME;
  }

  if (type !== MediaType.MOVIE && type !== MediaType.SERIES) {
    throw new AppException(
      HttpStatus.BAD_REQUEST,
      ErrorCode.CatalogMediaTypeRequired,
      undefined,
      "TMDB media require 'type' to be MOVIE or SERIES",
    );
  }

  return type;
}
