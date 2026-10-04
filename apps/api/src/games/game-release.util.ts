import {
  ErrorCode,
  isGameUpcoming,
  type ReleaseDatePrecision,
} from "@loomkeep/shared";
import { HttpStatus } from "@nestjs/common";
import { AppException } from "../common/app.exception";
import type { PrismaService } from "../prisma/prisma.service";

/** Whether a cached game isn't out yet. */
export function isGameItemUpcoming(game: {
  releaseDate: Date | null;
  releaseDatePrecision: ReleaseDatePrecision | null;
}): boolean {
  return isGameUpcoming(
    game.releaseDate?.toISOString().slice(0, 10) ?? null,
    game.releaseDatePrecision,
  );
}

/** Playing, owning or rating a game waits for its release. */
export async function assertGameReleased(
  prisma: PrismaService,
  gameItemId: string,
): Promise<void> {
  const game = await prisma.gameItem.findUnique({
    where: { id: gameItemId },
    select: { releaseDate: true, releaseDatePrecision: true },
  });

  if (game && isGameItemUpcoming(game)) {
    throw new AppException(
      HttpStatus.BAD_REQUEST,
      ErrorCode.LibraryGameNotReleased,
    );
  }
}
