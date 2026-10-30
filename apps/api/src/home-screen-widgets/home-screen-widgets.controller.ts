import {
  HOME_SCREEN_WIDGET_PARTS,
  type HomeScreenWidgetFeedDto,
  type HomeScreenWidgetPart,
} from "@loomkeep/shared";
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseEnumPipe,
  Post,
  Query,
} from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { JwtPayload } from "../auth/decorators/current-user.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Public } from "../auth/decorators/public.decorator";
import { HOME_SCREEN_WIDGET_THROTTLE } from "../common/throttle.constants";
import {
  HomeScreenWidgetFeedResponseDto,
  HomeScreenWidgetTokenResponseDto,
} from "./dto/home-screen-widget-response.dto";
import { StartTimerDto } from "./dto/start-timer.dto";
import { WatchNextDto } from "./dto/watch-next.dto";
import { HomeScreenWidgetsService } from "./home-screen-widgets.service";

const TIMER_STEPS = {
  pause: "pause",
  resume: "resume",
  finish: "finish",
} as const;
type TimerStep = (typeof TIMER_STEPS)[keyof typeof TIMER_STEPS];

/**
 * The Android app's home-screen widgets (MOB-20). The app asks for a token
 * with its session; the widgets then send it as `X-Widget-Token`, with no
 * session of their own.
 */
@Controller("home-screen-widgets")
export class HomeScreenWidgetsController {
  constructor(private readonly widgets: HomeScreenWidgetsService) {}

  @Post("token")
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: HomeScreenWidgetTokenResponseDto })
  token(@CurrentUser() user: JwtPayload): HomeScreenWidgetTokenResponseDto {
    return this.widgets.token(user.sub, user.sid);
  }

  /** `include` lists the parts the placed widgets read; an APK from before it reads the first two. */
  @Public()
  @Throttle(HOME_SCREEN_WIDGET_THROTTLE)
  @Get("feed")
  @ApiOkResponse({ type: HomeScreenWidgetFeedResponseDto })
  async feed(
    @Headers("x-widget-token") token?: string,
    @Headers("accept-language") acceptLanguage?: string,
    @Query("lang") lang?: string,
    @Query("include") include?: string,
  ): Promise<HomeScreenWidgetFeedDto> {
    const userId = await this.widgets.authenticate(token);
    return this.widgets.feed(userId, parts(include), lang, acceptLanguage);
  }

  /** The ✓ on « À suivre »: answers with the feed as it now stands. */
  @Public()
  @Throttle(HOME_SCREEN_WIDGET_THROTTLE)
  @Post("watch-next")
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: HomeScreenWidgetFeedResponseDto })
  async watchNext(
    @Body() dto: WatchNextDto,
    @Headers("x-widget-token") token?: string,
    @Headers("accept-language") acceptLanguage?: string,
    @Query("lang") lang?: string,
    @Query("include") include?: string,
  ): Promise<HomeScreenWidgetFeedDto> {
    const userId = await this.widgets.authenticate(token);
    await this.widgets.watchNext(userId, dto);
    return this.widgets.feed(userId, parts(include), lang, acceptLanguage);
  }

  /** « Chrono »: starts a session on a game or a book, then answers with the feed. */
  @Public()
  @Throttle(HOME_SCREEN_WIDGET_THROTTLE)
  @Post("timer/start")
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: HomeScreenWidgetFeedResponseDto })
  async startTimer(
    @Body() dto: StartTimerDto,
    @Headers("x-widget-token") token?: string,
    @Headers("accept-language") acceptLanguage?: string,
    @Query("lang") lang?: string,
    @Query("include") include?: string,
  ): Promise<HomeScreenWidgetFeedDto> {
    const userId = await this.widgets.authenticate(token);
    await this.widgets.startTimer(userId, dto);
    return this.widgets.feed(userId, parts(include), lang, acceptLanguage);
  }

  /** « Chrono »: `pause`, `resume`, or `finish` to save the session. */
  @Public()
  @Throttle(HOME_SCREEN_WIDGET_THROTTLE)
  @Post("timer/:step")
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: HomeScreenWidgetFeedResponseDto })
  async timerStep(
    @Param("step", new ParseEnumPipe(TIMER_STEPS)) step: TimerStep,
    @Headers("x-widget-token") token?: string,
    @Headers("accept-language") acceptLanguage?: string,
    @Query("lang") lang?: string,
    @Query("include") include?: string,
  ): Promise<HomeScreenWidgetFeedDto> {
    const userId = await this.widgets.authenticate(token);
    if (step === TIMER_STEPS.pause) await this.widgets.pauseTimer(userId);
    else if (step === TIMER_STEPS.resume)
      await this.widgets.resumeTimer(userId);
    else await this.widgets.finishTimer(userId);
    return this.widgets.feed(userId, parts(include), lang, acceptLanguage);
  }
}

function parts(include: string | undefined): Set<HomeScreenWidgetPart> {
  if (!include) return new Set(["toWatch", "releases"]);
  return new Set(
    include
      .split(",")
      .filter((part): part is HomeScreenWidgetPart =>
        (HOME_SCREEN_WIDGET_PARTS as readonly string[]).includes(part),
      ),
  );
}
