import type { MyYearDto, OnThisDayEntryDto } from "@loomkeep/shared";
import { ErrorCode } from "@loomkeep/shared";
import { Controller, Get, HttpStatus, Query } from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import type { JwtPayload } from "../auth/decorators/current-user.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AppException } from "../common/app.exception";
import { MyYearResponseDto } from "./dto/my-year-response.dto";
import { OnThisDayEntryResponseDto } from "./dto/on-this-day-entry-response.dto";
import { HomeStatsService } from "./home-stats.service";

const LOCAL_DAY = /^\d{4}-\d{2}-\d{2}$/;

// The client sends its own calendar day, so "a year ago today" follows the
// viewer's timezone rather than the server's.
@Controller("stats")
export class HomeStatsController {
  constructor(private readonly homeStats: HomeStatsService) {}

  @Get("on-this-day")
  @ApiOkResponse({ type: OnThisDayEntryResponseDto, isArray: true })
  onThisDay(
    @CurrentUser() user: JwtPayload,
    @Query("date") date = "",
  ): Promise<OnThisDayEntryDto[]> {
    if (!LOCAL_DAY.test(date) || Number.isNaN(Date.parse(date)))
      throw invalid("date", date);
    return this.homeStats.onThisDay(user.sub, date);
  }

  /** The « Mon année » widget: the client sends its own year, as above. */
  @Get("my-year")
  @ApiOkResponse({ type: MyYearResponseDto })
  myYear(
    @CurrentUser() user: JwtPayload,
    @Query("year") yearParam = "",
  ): Promise<MyYearDto> {
    const year = Number(yearParam);
    if (!/^\d{4}$/.test(yearParam) || year < 1900)
      throw invalid("year", yearParam);
    return this.homeStats.myYear(user.sub, year);
  }
}

const invalid = (label: string, value: string) =>
  new AppException(
    HttpStatus.BAD_REQUEST,
    ErrorCode.InvalidParam,
    { label, value },
    `Invalid ${label} '${value}'`,
  );
