import type {
  ApiV1CalendarEpisodeDto,
  ApiV1LibraryEntryDto,
  PagedResult,
} from "@loomkeep/shared";
import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiOkResponse, ApiOperation } from "@nestjs/swagger";
import { PublicApi } from "../../../api-keys/public-api.decorator";
import type { JwtPayload } from "../../../auth/decorators/current-user.decorator";
import { CurrentUser } from "../../../auth/decorators/current-user.decorator";
import { DEFAULT_PAGE_SIZE } from "../../../common/pagination.util";
import { CalendarQueryDto, LibraryQueryDto } from "../dto/queries.dto";
import {
  ApiV1CalendarEpisodeResponseDto,
  ApiV1LibraryEntryResponseDto,
  ApiV1LibraryPageResponseDto,
} from "../dto/responses.dto";
import { LibraryV1Service } from "../library-v1.service";

@PublicApi("Library", "library")
@Controller({ path: "library", version: "1" })
export class LibraryV1Controller {
  constructor(private readonly library: LibraryV1Service) {}

  @Get()
  @ApiOperation({
    summary: "List library entries",
    description:
      "Every tracked work across the enabled domains, or one domain with `domain`. Filter by normalised status with `phase`.",
  })
  @ApiOkResponse({ type: ApiV1LibraryPageResponseDto })
  list(
    @CurrentUser() user: JwtPayload,
    @Query() query: LibraryQueryDto,
  ): Promise<PagedResult<ApiV1LibraryEntryDto>> {
    return this.library.list(user.sub, {
      domain: query.domain,
      phases: query.phase,
      favorite: query.favorite === "true" || undefined,
      sort: query.sort ?? "added",
      order: query.order ?? "desc",
      page: query.page ?? 1,
      limit: query.limit ?? DEFAULT_PAGE_SIZE,
    });
  }

  @Get(":id")
  @ApiOperation({ summary: "Get one library entry" })
  @ApiOkResponse({ type: ApiV1LibraryEntryResponseDto })
  get(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
  ): Promise<ApiV1LibraryEntryDto> {
    return this.library.get(user.sub, id);
  }
}

@PublicApi("Calendar", "calendar")
@Controller({ path: "calendar", version: "1" })
export class CalendarV1Controller {
  constructor(private readonly library: LibraryV1Service) {}

  @Get()
  @ApiOperation({
    summary: "Upcoming episodes",
    description:
      "Episodes airing from today on, for the shows being followed (60 at most).",
  })
  @ApiOkResponse({ type: ApiV1CalendarEpisodeResponseDto, isArray: true })
  calendar(
    @CurrentUser() user: JwtPayload,
    @Query() query: CalendarQueryDto,
  ): Promise<ApiV1CalendarEpisodeDto[]> {
    return this.library.calendar(user.sub, query.days ?? 7);
  }
}
