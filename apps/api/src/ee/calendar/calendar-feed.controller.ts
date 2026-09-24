import type { CalendarTokenDto } from "@loomkeep/shared";
import { ErrorCode } from "@loomkeep/shared";
import {
  Controller,
  Get,
  HttpStatus,
  Post,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse } from "@nestjs/swagger";
import type { FastifyReply } from "fastify";
import type { JwtPayload } from "../../auth/decorators/current-user.decorator";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import { Public } from "../../auth/decorators/public.decorator";
import { AppException } from "../../common/app.exception";
import { EeLicenseGuard } from "../licensing/ee-license.guard";
import { CalendarFeedService } from "./calendar-feed.service";
import { CalendarTokenResponseDto } from "./dto/calendar-token-response.dto";

/**
 * Keeps the routes the feature had before moving to `ee/`: subscribed
 * calendar apps already poll `/library/calendar.ics`.
 */
@UseGuards(EeLicenseGuard)
@Controller()
export class CalendarFeedController {
  constructor(private readonly calendarFeed: CalendarFeedService) {}

  /**
   * Public (no auth) so Google/Apple Calendar can poll it directly by URL —
   * subscription clients can't send an Authorization header. Gated by the
   * unguessable per-user `calendarToken` instead, same pattern as the avatar
   * route.
   */
  @Public()
  @Get("library/calendar.ics")
  async getCalendarIcs(
    @Query("token") token: string | undefined,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const ics = token ? await this.calendarFeed.getCalendarIcs(token) : null;

    if (!ics) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.LibraryCalendarUnavailable,
      );
    }

    reply
      .header("Content-Type", "text/calendar; charset=utf-8")
      .header("Content-Disposition", 'inline; filename="loomkeep.ics"')
      .send(ics);
  }

  @Get("users/me/calendar-token")
  @ApiOkResponse({ type: CalendarTokenResponseDto })
  getToken(@CurrentUser() payload: JwtPayload): Promise<CalendarTokenDto> {
    return this.calendarFeed.getToken(payload.sub);
  }

  /** Issues a new token, invalidating any previously shared .ics link. */
  @Post("users/me/calendar-token/regenerate")
  @ApiCreatedResponse({ type: CalendarTokenResponseDto })
  regenerateToken(
    @CurrentUser() payload: JwtPayload,
  ): Promise<CalendarTokenDto> {
    return this.calendarFeed.regenerateToken(payload.sub);
  }
}
