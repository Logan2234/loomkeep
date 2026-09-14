import type { MediaDetailDto } from "@loomkeep/shared";
import { ErrorCode, MediaType } from "@loomkeep/shared";
import { Controller, Get, HttpStatus, Param, Query } from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import type { JwtPayload } from "../auth/decorators/current-user.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AppException } from "../common/app.exception";
import { safeLang } from "../common/locale.util";
import { MediaDetailResponseDto } from "./dto/media-detail-response.dto";
import { LibraryService } from "./library.service";

/**
 * Unified media page, addressed by catalogue identity (`type` + source `id`).
 * `type` determines the source (MOVIE/SERIES → TMDB, ANIME → AniList), so no
 * source segment is needed in the URL. Works whether or not the media is in the
 * user's library.
 */
@Controller("media")
export class MediaController {
  constructor(private readonly libraryService: LibraryService) {}

  @Get(":type/:id")
  @ApiOkResponse({ type: MediaDetailResponseDto })
  getMediaDetail(
    @CurrentUser() user: JwtPayload,
    @Param("type") typeParam: string,
    @Param("id") id: string,
    @Query("lang") lang?: string,
  ): Promise<MediaDetailDto> {
    return this.libraryService.getMediaDetail(
      user.sub,
      parseType(typeParam),
      id,
      safeLang(lang),
    );
  }
}

function parseType(value: string): MediaType {
  const upper = value.toUpperCase();

  if (
    upper !== MediaType.MOVIE &&
    upper !== MediaType.SERIES &&
    upper !== MediaType.ANIME
  ) {
    throw new AppException(
      HttpStatus.BAD_REQUEST,
      ErrorCode.CatalogUnknownMediaType,
      { value },
      `Unknown media type '${value}'`,
    );
  }

  return upper;
}
