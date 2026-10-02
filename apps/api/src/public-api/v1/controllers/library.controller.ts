import type {
  ApiV1CalendarEpisodeDto,
  ApiV1HistoryEventDto,
  ApiV1LibraryEntryDto,
  PagedResult,
} from "@loomkeep/shared";
import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiOperation, ApiParam } from "@nestjs/swagger";
import { PublicApi } from "../../../api-keys/public-api.decorator";
import type { JwtPayload } from "../../../auth/decorators/current-user.decorator";
import { CurrentUser } from "../../../auth/decorators/current-user.decorator";
import { DEFAULT_PAGE_SIZE } from "../../../common/pagination.util";
import {
  ApiV1BadRequest,
  ApiV1NotFound,
  ApiV1OkResponse,
} from "../api-responses";
import {
  CalendarQueryDto,
  EntryHistoryQueryDto,
  HistoryQueryDto,
  LangQueryDto,
  LibraryQueryDto,
} from "../dto/queries.dto";
import {
  ApiV1CalendarEpisodeResponseDto,
  ApiV1HistoryPageResponseDto,
  ApiV1LibraryEntryResponseDto,
  ApiV1LibraryPageResponseDto,
} from "../dto/responses.dto";
import { HistoryV1Service, historyRange } from "../history-v1.service";
import { LibraryV1Service } from "../library-v1.service";

@PublicApi("Library", "library")
@Controller({ path: "library", version: "1" })
export class LibraryV1Controller {
  constructor(
    private readonly library: LibraryV1Service,
    private readonly history: HistoryV1Service,
  ) {}

  @Get()
  @ApiOperation({
    operationId: "listLibraryEntries",
    summary: "List library entries",
    description:
      "Every tracked work across the enabled domains, or one domain with `domain`. Filter by normalised status with `phase`, sort with `sort` and `order`. Asking for a domain turned off for the account is a `403` (`user.domain_disabled`).",
  })
  @ApiV1BadRequest()
  @ApiV1OkResponse({ type: ApiV1LibraryPageResponseDto })
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
      lang: query.lang,
    });
  }

  @Get(":id")
  @ApiOperation({
    operationId: "getLibraryEntry",
    summary: "Get one library entry",
    description:
      "One entry, whatever its domain: its status, rating, progress and work.",
  })
  @ApiParam({
    name: "id",
    description: "A library entry id, from `GET /v1/library`.",
    example: "cm1q2w3e4r5t6y7u8i9o0p1a",
  })
  @ApiV1NotFound(
    "library.entry_not_found",
    "No such entry in the caller's library, or its domain is turned off.",
  )
  @ApiV1BadRequest()
  @ApiV1OkResponse({ type: ApiV1LibraryEntryResponseDto })
  get(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Query() query: LangQueryDto,
  ): Promise<ApiV1LibraryEntryDto> {
    return this.library.get(user.sub, id, query.lang);
  }

  @Get(":id/history")
  @ApiOperation({
    operationId: "listEntryHistory",
    summary: "One entry's history",
    description:
      "Every viewing, session and finish of this entry, newest first. Undated ones (often from an import) come last, with a null `date`.",
  })
  @ApiParam({
    name: "id",
    description: "A library entry id, from `GET /v1/library`.",
    example: "cm1q2w3e4r5t6y7u8i9o0p1a",
  })
  @ApiV1NotFound(
    "library.entry_not_found",
    "No such entry in the caller's library, or its domain is turned off.",
  )
  @ApiV1BadRequest()
  @ApiV1OkResponse({ type: ApiV1HistoryPageResponseDto })
  entryHistory(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Query() query: EntryHistoryQueryDto,
  ): Promise<PagedResult<ApiV1HistoryEventDto>> {
    return this.history.forEntry(user.sub, id, {
      page: query.page ?? 1,
      limit: query.limit ?? DEFAULT_PAGE_SIZE,
      lang: query.lang,
    });
  }
}

@PublicApi("History", "library")
@Controller({ path: "history", version: "1" })
export class HistoryV1Controller {
  constructor(private readonly history: HistoryV1Service) {}

  @Get()
  @ApiOperation({
    operationId: "listHistory",
    summary: "Consumption history",
    description:
      "Episodes and films seen, game and reading sessions, finished games, books and albums, across the enabled domains, newest first. Only dated events: an undated one shows in its entry's own history.",
  })
  @ApiV1BadRequest()
  @ApiV1OkResponse({ type: ApiV1HistoryPageResponseDto })
  list(
    @CurrentUser() user: JwtPayload,
    @Query() query: HistoryQueryDto,
  ): Promise<PagedResult<ApiV1HistoryEventDto>> {
    return this.history.list(user.sub, {
      range: historyRange(query.from, query.to),
      domain: query.domain,
      page: query.page ?? 1,
      limit: query.limit ?? DEFAULT_PAGE_SIZE,
      lang: query.lang,
    });
  }
}

@PublicApi("Calendar", "calendar")
@Controller({ path: "calendar", version: "1" })
export class CalendarV1Controller {
  constructor(private readonly library: LibraryV1Service) {}

  @Get()
  @ApiOperation({
    operationId: "listUpcomingEpisodes",
    summary: "Upcoming episodes",
    description:
      "Episodes airing from today on, for the shows being followed (60 at most).",
  })
  @ApiV1BadRequest()
  @ApiV1OkResponse({ type: ApiV1CalendarEpisodeResponseDto, isArray: true })
  calendar(
    @CurrentUser() user: JwtPayload,
    @Query() query: CalendarQueryDto,
  ): Promise<ApiV1CalendarEpisodeDto[]> {
    return this.library.calendar(user.sub, query.days ?? 7, query.lang);
  }
}
