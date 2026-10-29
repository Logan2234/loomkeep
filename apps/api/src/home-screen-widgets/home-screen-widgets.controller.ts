import type { HomeScreenWidgetFeedDto } from "@loomkeep/shared";
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
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
import { WatchNextDto } from "./dto/watch-next.dto";
import { HomeScreenWidgetsService } from "./home-screen-widgets.service";

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

  @Public()
  @Throttle(HOME_SCREEN_WIDGET_THROTTLE)
  @Get("feed")
  @ApiOkResponse({ type: HomeScreenWidgetFeedResponseDto })
  async feed(
    @Headers("x-widget-token") token?: string,
    @Headers("accept-language") acceptLanguage?: string,
    @Query("lang") lang?: string,
  ): Promise<HomeScreenWidgetFeedDto> {
    const userId = await this.widgets.authenticate(token);
    return this.widgets.feed(userId, lang, acceptLanguage);
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
  ): Promise<HomeScreenWidgetFeedDto> {
    const userId = await this.widgets.authenticate(token);
    await this.widgets.watchNext(userId, dto);
    return this.widgets.feed(userId, lang, acceptLanguage);
  }
}
