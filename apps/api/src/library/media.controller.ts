import { BadRequestException, Controller, Get, Param } from "@nestjs/common";
import { MediaType } from "@loomkeep/shared";
import type { MediaDetailDto } from "@loomkeep/shared";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { JwtPayload } from "../auth/decorators/current-user.decorator";
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
  getMediaDetail(
    @CurrentUser() user: JwtPayload,
    @Param("type") typeParam: string,
    @Param("id") id: string,
  ): Promise<MediaDetailDto> {
    return this.libraryService.getMediaDetail(
      user.sub,
      parseType(typeParam),
      id,
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
    throw new BadRequestException(`Unknown media type '${value}'`);
  }

  return upper;
}
