import {
  ErrorCode,
  isAnimeUnaired,
  movieReleaseDates,
  movieReleaseInfo,
} from "@loomkeep/shared";
import { HttpStatus } from "@nestjs/common";
import { AppException } from "../common/app.exception";
import type { PrismaService } from "../prisma/prisma.service";

/**
 * Refuses completing, rating or reviewing a title that isn't out yet: a film
 * before its first public release, or an announced anime that hasn't started
 * airing. Following it (PLANNED) stays allowed.
 */
export async function assertMediaReleased(
  prisma: PrismaService,
  mediaItemId: string,
): Promise<void> {
  const media = await prisma.mediaItem.findUnique({
    where: { id: mediaItemId },
  });

  if (
    media?.type === "MOVIE" &&
    movieReleaseInfo(
      movieReleaseDates(media.movieReleaseDates),
      media.status,
      "US",
    ).upcoming
  ) {
    throw new AppException(
      HttpStatus.BAD_REQUEST,
      ErrorCode.LibraryMovieNotReleased,
    );
  }

  if (media?.type === "ANIME" && isAnimeUnaired(media.status)) {
    throw new AppException(
      HttpStatus.BAD_REQUEST,
      ErrorCode.LibraryAnimeNotAired,
    );
  }
}
