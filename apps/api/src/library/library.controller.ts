import type {
  CalendarEntryDto,
  LibraryDomainCountsDto,
} from "@loomkeep/shared/contracts";
import { Controller, Get, Headers } from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import type { JwtPayload } from "../auth/decorators/current-user.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { CalendarService } from "./calendar.service";
import { CalendarEntryResponseDto } from "./dto/calendar-entry-response.dto";
import { LibraryDomainCountsResponseDto } from "./dto/library-domain-counts-response.dto";
import { LibraryService } from "./library.service";

/** The routes that read every domain at once; each domain has its own. */
@Controller("library")
export class LibraryController {
  constructor(
    private readonly library: LibraryService,
    private readonly calendar: CalendarService,
  ) {}

  /** Per domain, how many items the user tracks — hidden domains included. */
  @Get("domain-counts")
  @ApiOkResponse({ type: LibraryDomainCountsResponseDto })
  getDomainCounts(
    @CurrentUser() user: JwtPayload,
  ): Promise<LibraryDomainCountsDto> {
    return this.library.getDomainCounts(user.sub);
  }

  @Get("calendar")
  @ApiOkResponse({ type: CalendarEntryResponseDto, isArray: true })
  getCalendar(
    @CurrentUser() user: JwtPayload,
    @Headers("accept-language") acceptLanguage?: string,
  ): Promise<CalendarEntryDto[]> {
    return this.calendar.getCalendar(user.sub, acceptLanguage);
  }
}
