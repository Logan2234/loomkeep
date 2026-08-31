import {
  CastDetailDto,
  CatalogSource,
  Domain,
  ErrorCode,
  Locale,
  MediaExtrasDto,
  MediaType,
  SearchResponseDto,
} from "@loomkeep/shared";
import { Controller, Get, HttpStatus, Param, Query } from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import type { JwtPayload } from "../auth/decorators/current-user.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AppException } from "../common/app.exception";
import { PagedResponseDto } from "../common/dto/paged-response.dto";
import { parseEnumParam } from "../common/parse-enum-param.util";
import { AgeGateService } from "../users/age-gate.service";
import { filterAdultContent } from "../users/age.util";
import { DomainGateService } from "../users/domain-gate.service";
import { CastDetailResponseDto } from "./dto/cast-detail-response.dto";
import { MediaExtrasResponseDto } from "./dto/media-extras-response.dto";
import { MediaSummaryResponseDto } from "./dto/media-summary-response.dto";
import { SearchQueryDto } from "./dto/search-query.dto";
import { MediaItemService } from "./media-item.service";
import { rankBySearchRelevance } from "./search-ranking";

@Controller("catalog")
export class CatalogController {
  constructor(
    private readonly mediaItemService: MediaItemService,
    private readonly ageGate: AgeGateService,
    private readonly domainGate: DomainGateService,
  ) {}

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
    await this.domainGate.assertEnabled(user.sub, Domain.MEDIA);

    const wantTmdb = query.type === undefined || query.type !== MediaType.ANIME;
    const wantAnilist =
      query.type === undefined || query.type === MediaType.ANIME;
    const page = query.page ?? 1;

    const [tmdbResults, anilistResults, allowAdult] = await Promise.all([
      wantTmdb
        ? this.mediaItemService
            .providerFor(CatalogSource.TMDB)
            .search(query.q, query.type, page, query.lang)
            .catch(() => [])
        : Promise.resolve([]),
      wantAnilist
        ? this.mediaItemService
            .providerFor(CatalogSource.ANILIST)
            .search(query.q, undefined, page)
            .catch(() => [])
        : Promise.resolve([]),
      this.ageGate.allowsAdultContent(user.sub),
    ]);

    // Each source returns its own popularity order, but concatenating movies +
    // series + anime buries the searched title. Re-rank by title relevance so
    // the actual match floats to the top (ties keep the source order).
    const items = filterAdultContent(
      rankBySearchRelevance([...anilistResults, ...tmdbResults], query.q),
      allowAdult,
    );

    // Neither provider reports a total, so "more" just means this page
    // wasn't empty — matches how a provider's own pagination ends (an empty
    // page), same heuristic the client used before this moved server-side.
    return { items, hasMore: items.length > 0 };
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

  /** Live extras (where to watch, cast, similar) — nothing is persisted. */
  @Get(":source/:id/extras")
  @ApiOkResponse({ type: MediaExtrasResponseDto })
  async getExtras(
    @CurrentUser() user: JwtPayload,
    @Param("source") sourceParam: string,
    @Param("id") id: string,
    @Query("type") type?: MediaType,
    @Query("lang") lang?: string,
  ): Promise<MediaExtrasDto> {
    const source = parseSource(sourceParam);
    const resolvedType = resolveType(source, type);
    const extras = await this.mediaItemService
      .providerFor(source)
      .getExtras(id, resolvedType, safeLang(lang));
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

/** `lang` unrecognized or absent → undefined, letting the provider pick its own default. */
function safeLang(lang: string | undefined): string | undefined {
  return Locale.includes(lang as Locale) ? lang : undefined;
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
