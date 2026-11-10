import { CreatorSource, Domain, PersonPageDto } from "@loomkeep/shared";
import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import type { JwtPayload } from "../auth/decorators/current-user.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { safeLang } from "../common/locale.util";
import { parseEnumParam } from "../common/parse-enum-param.util";
import { DomainGateService } from "../users/domain-gate.service";
import { CreatorService } from "./creator.service";
import { PersonPageResponseDto } from "./dto/person-page-response.dto";

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
}
