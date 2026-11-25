import type { ArrTokenDto } from "@loomkeep/shared";
import { ErrorCode } from "@loomkeep/shared";
import {
  Controller,
  Get,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse } from "@nestjs/swagger";
import type { JwtPayload } from "../../auth/decorators/current-user.decorator";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import { Public } from "../../auth/decorators/public.decorator";
import { AppException } from "../../common/app.exception";
import { EeLicenseGuard } from "../licensing/ee-license.guard";
import { ArrFeedService } from "./arr-feed.service";
import {
  type ArrFeedItem,
  radarrList,
  type RadarrListItem,
  sonarrList,
  type SonarrListItem,
} from "./arr-feed.util";
import { ArrTokenResponseDto } from "./dto/arr-token-response.dto";

/**
 * Import lists for Radarr and Sonarr. Public for the same reason as the
 * calendar: those tools fetch a plain URL and can't sign in, so the
 * member's arr token in the query string is the credential.
 */
@UseGuards(EeLicenseGuard)
@Controller()
export class ArrFeedController {
  constructor(private readonly feeds: ArrFeedService) {}

  @Public()
  @Get("library/radarr.json")
  async pileForRadarr(
    @Query("token") token: string | undefined,
  ): Promise<RadarrListItem[]> {
    return radarrList(found(token ? await this.feeds.pile(token) : null));
  }

  @Public()
  @Get("library/sonarr.json")
  async pileForSonarr(
    @Query("token") token: string | undefined,
  ): Promise<SonarrListItem[]> {
    return sonarrList(found(token ? await this.feeds.pile(token) : null));
  }

  @Public()
  @Get("lists/:listId/radarr.json")
  async listForRadarr(
    @Param("listId") listId: string,
    @Query("token") token: string | undefined,
  ): Promise<RadarrListItem[]> {
    return radarrList(
      found(token ? await this.feeds.list(token, listId) : null),
    );
  }

  @Public()
  @Get("lists/:listId/sonarr.json")
  async listForSonarr(
    @Param("listId") listId: string,
    @Query("token") token: string | undefined,
  ): Promise<SonarrListItem[]> {
    return sonarrList(
      found(token ? await this.feeds.list(token, listId) : null),
    );
  }

  @Get("users/me/arr-token")
  @ApiOkResponse({ type: ArrTokenResponseDto })
  getToken(@CurrentUser() payload: JwtPayload): Promise<ArrTokenDto> {
    return this.feeds.getToken(payload.sub);
  }

  /** Issues a new token, invalidating every link given to Radarr or Sonarr. */
  @Post("users/me/arr-token/regenerate")
  @ApiCreatedResponse({ type: ArrTokenResponseDto })
  regenerateToken(@CurrentUser() payload: JwtPayload): Promise<ArrTokenDto> {
    return this.feeds.regenerateToken(payload.sub);
  }
}

function found(items: ArrFeedItem[] | null): ArrFeedItem[] {
  if (!items) {
    throw new AppException(
      HttpStatus.NOT_FOUND,
      ErrorCode.LibraryCalendarUnavailable,
    );
  }

  return items;
}
