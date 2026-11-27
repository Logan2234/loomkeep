import { ErrorCode } from "@loomkeep/shared/catalog";
import type {
  FiguresDto,
  MyYearDto,
  OnThisDayEntryDto,
  ProfileFiguresDto,
} from "@loomkeep/shared/contracts";
import { Domain } from "@loomkeep/shared/enums";
import { Controller, Get, HttpStatus, Param, Query } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiOkResponse } from "@nestjs/swagger";
import type { JwtPayload } from "../auth/decorators/current-user.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AppException } from "../common/app.exception";
import { ProfileService } from "../social/profile.service";
import { isSocialEnabled } from "../social/social.config";
import { MyYearResponseDto } from "./dto/my-year-response.dto";
import { OnThisDayEntryResponseDto } from "./dto/on-this-day-entry-response.dto";
import { ProfileFiguresResponseDto } from "./dto/profile-figures-response.dto";
import { HomeStatsService } from "./home-stats.service";

const LOCAL_DAY = /^\d{4}-\d{2}-\d{2}$/;

// The client sends its own calendar day, so "a year ago today" follows the
// viewer's timezone rather than the server's.
@Controller("stats")
export class HomeStatsController {
  constructor(
    private readonly homeStats: HomeStatsService,
    private readonly profiles: ProfileService,
    private readonly config: ConfigService,
  ) {}

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
    return this.homeStats.myYear(user.sub, parseYear(yearParam));
  }

  /**
   * A profile's « En chiffres » (PRV-05). Each domain shows only where the
   * viewer may see that library; without social features, only your own.
   */
  @Get("profiles/:username/figures")
  @ApiOkResponse({ type: ProfileFiguresResponseDto })
  async profileFigures(
    @CurrentUser() user: JwtPayload,
    @Param("username") username: string,
    @Query("year") yearParam = "",
  ): Promise<ProfileFiguresDto> {
    const year = parseYear(yearParam);
    const { userId, isSelf, domains } = await this.profiles.libraryVisibility(
      user.sub,
      username,
    );
    if (!isSelf && !isSocialEnabled(this.config))
      throw new AppException(HttpStatus.NOT_FOUND, ErrorCode.UserNotFound);

    const figures = await this.homeStats.profileFigures(userId, year);
    const shown = isSelf ? null : new Set(domains);
    return {
      thisYear: { year, ...onlyVisible(figures.thisYear, shown) },
      allTime: onlyVisible(figures.allTime, shown),
    };
  }
}

const FIGURE_DOMAINS = {
  video: Domain.MEDIA,
  games: Domain.GAMES,
  books: Domain.BOOKS,
  music: Domain.MUSIC,
} as const satisfies Record<keyof FiguresDto, Domain>;

/** Drops the blocks of domains hidden from the viewer (`null`: none are). */
function onlyVisible(figures: FiguresDto, shown: Set<Domain> | null) {
  const visible: FiguresDto = {};

  for (const key of Object.keys(FIGURE_DOMAINS) as (keyof FiguresDto)[]) {
    if (figures[key] && (!shown || shown.has(FIGURE_DOMAINS[key])))
      Object.assign(visible, { [key]: figures[key] });
  }

  return visible;
}

function parseYear(value: string): number {
  const year = Number(value);
  if (!/^\d{4}$/.test(value) || year < 1900) throw invalid("year", value);
  return year;
}

const invalid = (label: string, value: string) =>
  new AppException(
    HttpStatus.BAD_REQUEST,
    ErrorCode.InvalidParam,
    { label, value },
    `Invalid ${label} '${value}'`,
  );
