import type { WorkSearchResultDto } from "@loomkeep/shared";
import { Controller, Get, Query } from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import {
  CurrentUser,
  type JwtPayload,
} from "../auth/decorators/current-user.decorator";
import { safeLang } from "../common/locale.util";
import { WORK_SEARCH_THROTTLE } from "../common/throttle.constants";
import { WorkSearchQueryDto } from "./dto/work-search-query.dto";
import { WorkSearchResultResponseDto } from "./dto/work-search-response.dto";
import { WorkSearchService } from "./work-search.service";

@Controller("search")
export class WorkSearchController {
  constructor(private readonly works: WorkSearchService) {}

  /** Works across every enabled domain, best match first. */
  @Get("works")
  @Throttle(WORK_SEARCH_THROTTLE)
  @ApiOkResponse({ type: WorkSearchResultResponseDto })
  search(
    @CurrentUser() user: JwtPayload,
    @Query() query: WorkSearchQueryDto,
  ): Promise<WorkSearchResultDto> {
    return this.works.search(user.sub, query.q, {
      catalogs: query.scope !== "local",
      lang: safeLang(query.lang),
    });
  }
}
