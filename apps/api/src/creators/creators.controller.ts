import {
  CreatorSource,
  CreatorWorkDto,
  PagedResult,
  PersonPageDto,
  StudioKind,
  StudioPageDto,
  StudioWorkOrder,
} from "@loomkeep/shared/contracts";
import { Domain, MediaType } from "@loomkeep/shared/enums";
import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import type { JwtPayload } from "../auth/decorators/current-user.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { PagedResponseDto } from "../common/dto/paged-response.dto";
import { safeLang } from "../common/locale.util";
import { parsePageQuery } from "../common/pagination.util";
import { parseEnumParam } from "../common/parse-enum-param.util";
import { DomainGateService } from "../users/domain-gate.service";
import { CreatorService } from "./creator.service";
import {
  CreatorWorkResponseDto,
  PersonPageResponseDto,
} from "./dto/person-page-response.dto";
import { StudioPageResponseDto } from "./dto/studio-page-response.dto";

@Controller("creators")
export class CreatorsController {
  constructor(
    private readonly creators: CreatorService,
    private readonly domainGate: DomainGateService,
  ) {}

  /** A person's page: identity and works, each with the viewer's status. */
  @Get(":source/person/:id")
  @ApiOkResponse({ type: PersonPageResponseDto })
  async getPerson(
    @CurrentUser() user: JwtPayload,
    @Param("source") sourceParam: string,
    @Param("id") id: string,
    @Query("lang") lang?: string,
  ): Promise<PersonPageDto> {
    const source = parseEnumParam(
      sourceParam.toLowerCase(),
      Object.values(CreatorSource),
      "creator source",
      { caseSensitive: true },
    );
    await this.domainGate.assertEnabled(
      user.sub,
      source === CreatorSource.OPEN_LIBRARY ? Domain.BOOKS : Domain.MEDIA,
    );
    return this.creators.getPerson(user.sub, source, id, safeLang(lang));
  }

  /** A production company: identity and how many films and series it made. */
  @Get(":source/company/:id")
  @ApiOkResponse({ type: StudioPageResponseDto })
  getCompany(
    @CurrentUser() user: JwtPayload,
    @Param("source") source: string,
    @Param("id") id: string,
    @Query("lang") lang?: string,
  ): Promise<StudioPageDto> {
    return this.studio(user, StudioKind.COMPANY, source, id, lang);
  }

  /** A production company's films or series, a page at a time. */
  @Get(":source/company/:id/works")
  @ApiOkResponse({ type: PagedResponseDto(CreatorWorkResponseDto) })
  getCompanyWorks(
    @CurrentUser() user: JwtPayload,
    @Param("source") source: string,
    @Param("id") id: string,
    @Query("type") type: string,
    @Query("order") order?: string,
    @Query("page") page?: string,
    @Query("lang") lang?: string,
  ): Promise<PagedResult<CreatorWorkDto>> {
    return this.studioWorks(
      user,
      StudioKind.COMPANY,
      source,
      id,
      { type, order, page },
      lang,
    );
  }

  /** A network: identity and how many series it aired. */
  @Get(":source/network/:id")
  @ApiOkResponse({ type: StudioPageResponseDto })
  getNetwork(
    @CurrentUser() user: JwtPayload,
    @Param("source") source: string,
    @Param("id") id: string,
    @Query("lang") lang?: string,
  ): Promise<StudioPageDto> {
    return this.studio(user, StudioKind.NETWORK, source, id, lang);
  }

  /** A network's series, a page at a time. */
  @Get(":source/network/:id/works")
  @ApiOkResponse({ type: PagedResponseDto(CreatorWorkResponseDto) })
  getNetworkWorks(
    @CurrentUser() user: JwtPayload,
    @Param("source") source: string,
    @Param("id") id: string,
    @Query("type") type: string,
    @Query("order") order?: string,
    @Query("page") page?: string,
    @Query("lang") lang?: string,
  ): Promise<PagedResult<CreatorWorkDto>> {
    return this.studioWorks(
      user,
      StudioKind.NETWORK,
      source,
      id,
      { type, order, page },
      lang,
    );
  }

  private async studio(
    user: JwtPayload,
    kind: StudioKind,
    sourceParam: string,
    id: string,
    lang?: string,
  ): Promise<StudioPageDto> {
    const source = this.parseSource(sourceParam);
    await this.domainGate.assertEnabled(user.sub, Domain.MEDIA);
    return this.creators.getStudio(user.sub, source, kind, id, safeLang(lang));
  }

  private async studioWorks(
    user: JwtPayload,
    kind: StudioKind,
    sourceParam: string,
    id: string,
    query: { type: string; order?: string; page?: string },
    lang?: string,
  ): Promise<PagedResult<CreatorWorkDto>> {
    const source = this.parseSource(sourceParam);
    const type = parseEnumParam(
      query.type ?? "",
      [MediaType.MOVIE, MediaType.SERIES],
      "media type",
    );
    const order = parseEnumParam(
      query.order ?? StudioWorkOrder.KNOWN,
      Object.values(StudioWorkOrder),
      "order",
      { caseSensitive: true },
    );
    // Discover serves 20 titles a page: only the page number is the caller's.
    const { page } = parsePageQuery(query.page, undefined, 20);
    await this.domainGate.assertEnabled(user.sub, Domain.MEDIA);
    return this.creators.getStudioWorks(
      user.sub,
      source,
      kind,
      id,
      { type, order, page },
      safeLang(lang),
    );
  }

  private parseSource(sourceParam: string): CreatorSource {
    return parseEnumParam(
      sourceParam.toLowerCase(),
      Object.values(CreatorSource),
      "creator source",
      { caseSensitive: true },
    );
  }
}
