import {
  CastDetailDto,
  CatalogSource,
  Domain,
  EpisodeMediaDto,
  ErrorCode,
  MediaExtrasDto,
  MediaType,
  SearchResponseDto,
  SeasonImagesDto,
  WatchProviderCatalogDto,
} from "@loomkeep/shared";
import {
  Controller,
  Get,
  Headers,
  HttpStatus,
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
import { DomainGateService } from "../users/domain-gate.service";
import { CastDetailResponseDto } from "./dto/cast-detail-response.dto";
import { EpisodeMediaResponseDto } from "./dto/episode-media-response.dto";
import { MediaExtrasResponseDto } from "./dto/media-extras-response.dto";
import { MediaSummaryResponseDto } from "./dto/media-summary-response.dto";
import { SearchQueryDto } from "./dto/search-query.dto";
import { SeasonImagesResponseDto } from "./dto/season-images-response.dto";
import { WatchProviderCatalogResponseDto } from "./dto/watch-provider-catalog-response.dto";
import { MediaItemService } from "./media-item.service";
import { TmdbProvider } from "./providers/tmdb.provider";
import { rankBySearchRelevance } from "./search-ranking";
import { resolveWatchRegion } from "./watch-region.util";

@Controller("catalog")
export class CatalogController {
  constructor(
    private readonly mediaItemService: MediaItemService,
    private readonly ageGate: AgeGateService,
    private readonly domainGate: DomainGateService,
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
   * Live search on TMDB, where an anime is a Japanese animation. 18+ titles
   * are stripped unless the account opted in and is confirmed 18+.
   */
  @Get("search")
  @ApiOkResponse({ type: PagedResponseDto(MediaSummaryResponseDto) })
  async search(
    @CurrentUser() user: JwtPayload,
    @Query() query: SearchQueryDto,
  ): Promise<SearchResponseDto> {
    await this.domainGate.assertEnabled(user.sub, Domain.MEDIA);

    const [results, allowAdult] = await Promise.all([
      this.tmdb
        .searchPage(query.q, query.type, query.page ?? 1, query.lang)
        .catch(() => ({ items: [], hasMore: false })),
      this.ageGate.allowsAdultContent(user.sub),
    ]);

    // TMDB returns films and series each in its own popularity order, but
    // concatenating them buries the searched title. Re-rank by title
    // relevance so the actual match floats to the top (ties keep the order).
    const items = filterAdultContent(
      rankBySearchRelevance(results.items, query.q),
      allowAdult,
    );

    // TMDB reports no total here: "more" means its own page wasn't empty,
    // even when the type filter kept nothing of it.
    return { items, hasMore: results.hasMore };
  }

  /** Live detail of a TMDB person for the media-page cast modal. */
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
    const resolvedType = resolveType(type);
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
  return parseEnumParam(value, [CatalogSource.TMDB], "catalog source");
}

/** TMDB ids are per namespace: the caller says whether it is a film. */
function resolveType(type?: MediaType): MediaType {
  if (
    type !== MediaType.MOVIE &&
    type !== MediaType.SERIES &&
    type !== MediaType.ANIME
  ) {
    throw new AppException(
      HttpStatus.BAD_REQUEST,
      ErrorCode.CatalogMediaTypeRequired,
      undefined,
      "TMDB media require 'type' to be MOVIE, SERIES or ANIME",
    );
  }

  return type;
}
