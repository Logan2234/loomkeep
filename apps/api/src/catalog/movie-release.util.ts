import {
  ErrorCode,
  movieReleaseDates,
  movieReleaseInfo,
} from "@loomkeep/shared";
import { HttpStatus } from "@nestjs/common";
import { AppException } from "../common/app.exception";
import type { PrismaService } from "../prisma/prisma.service";

export async function assertMovieReleased(
  prisma: PrismaService,
  mediaItemId: string,
): Promise<void> {
  const movie = await prisma.mediaItem.findUnique({
    where: { id: mediaItemId },
  });

  if (
    movie?.type === "MOVIE" &&
    movieReleaseInfo(
      movieReleaseDates(movie.movieReleaseDates),
      movie.status,
      "US",
    ).upcoming
  ) {
    throw new AppException(
      HttpStatus.BAD_REQUEST,
      ErrorCode.LibraryMovieNotReleased,
    );
  }
}
