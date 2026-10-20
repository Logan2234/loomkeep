import type { PrismaService } from "../../../prisma/prisma.service";

import type { AchievementCheckResult } from "../types";
import { behaviourUser, DAY_MS, LOYAL_TIMES } from "./shared";

/** "cult_film": one movie watched LOYAL_TIMES times — its first watch plus rewatches. */
export async function checkCultFilm(
  prisma: PrismaService,
  userId: string,
): Promise<AchievementCheckResult> {
  const replays = await prisma.movieReplay.groupBy({
    by: ["libraryEntryId"],
    where: {
      libraryEntry: {
        userId,
        status: "COMPLETED",
        mediaItem: { type: "MOVIE" },
      },
    },
    _count: { _all: true },
  });
  return {
    unlocked: replays.some((r) => r._count._all >= LOYAL_TIMES - 1),
  };
}

/** "bedside_book": one book read to the end LOYAL_TIMES times. */
export async function checkBedsideBook(
  prisma: PrismaService,
  userId: string,
): Promise<AchievementCheckResult> {
  const readings = await prisma.bookReading.groupBy({
    by: ["bookEntryId"],
    where: { status: "COMPLETED", bookEntry: { userId } },
    _count: { _all: true },
  });
  return { unlocked: readings.some((r) => r._count._all >= LOYAL_TIMES) };
}

/** "comfort_game": one game finished LOYAL_TIMES times. */
export async function checkComfortGame(
  prisma: PrismaService,
  userId: string,
): Promise<AchievementCheckResult> {
  const playthroughs = await prisma.gamePlaythrough.groupBy({
    by: ["gameEntryId"],
    where: { status: "COMPLETED", gameEntry: { userId } },
    _count: { _all: true },
  });
  return { unlocked: playthroughs.some((p) => p._count._all >= LOYAL_TIMES) };
}

/** "worth_the_wait" (secret): a work finished a year or more after it was added. */
export async function checkWorthTheWait(
  prisma: PrismaService,
  userId: string,
): Promise<AchievementCheckResult> {
  const user = await behaviourUser(prisma, userId);
  if (!user) return { unlocked: false };

  // Two columns of one row can't be compared in a Prisma filter: read the
  // finished entries and compare here.
  const where = { userId, finishedAt: { gte: user.createdAt } };
  const select = { createdAt: true, finishedAt: true };
  const [media, games, books] = await Promise.all([
    prisma.libraryEntry.findMany({ where, select }),
    prisma.gameEntry.findMany({ where, select }),
    prisma.bookEntry.findMany({ where, select }),
  ]);
  const unlocked = [...media, ...games, ...books].some(
    (e) =>
      e.finishedAt !== null &&
      e.finishedAt.getTime() - e.createdAt.getTime() >= 365 * DAY_MS,
  );
  return { unlocked };
}

/**
 * "full_circle": the very first title the user ever tracked (earliest
 * created, across MEDIA/GAMES/BOOKS) has a replay row. Series/anime aren't
 * included as a possible "first title" here — there's no "series refinished
 * a second time" signal in the data model beyond individual episode
 * rewatches, unlike movies/games/books which have a dedicated replay table.
 */
export async function checkFullCircle(
  prisma: PrismaService,
  userId: string,
): Promise<AchievementCheckResult> {
  const [firstMedia, firstGame, firstBook] = await Promise.all([
    prisma.libraryEntry.findFirst({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { id: true, createdAt: true },
    }),
    prisma.gameEntry.findFirst({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { id: true, createdAt: true },
    }),
    prisma.bookEntry.findFirst({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { id: true, createdAt: true },
    }),
  ]);

  const candidates = (
    [
      firstMedia && { ...firstMedia, kind: "media" as const },
      firstGame && { ...firstGame, kind: "game" as const },
      firstBook && { ...firstBook, kind: "book" as const },
    ] as const
  ).filter((c): c is NonNullable<typeof c> => !!c);
  if (candidates.length === 0) return { unlocked: false };

  const first = [...candidates].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  )[0];

  if (first.kind === "media") {
    const replay = await prisma.movieReplay.findFirst({
      where: { libraryEntryId: first.id },
      select: { id: true },
    });
    return { unlocked: replay !== null };
  }

  if (first.kind === "game") {
    const replay = await prisma.gamePlaythrough.findFirst({
      where: { gameEntryId: first.id, status: "COMPLETED", number: { gt: 1 } },
      select: { id: true },
    });
    return { unlocked: replay !== null };
  }

  const replay = await prisma.bookReading.findFirst({
    where: { bookEntryId: first.id, status: "COMPLETED", number: { gt: 1 } },
    select: { id: true },
  });
  return { unlocked: replay !== null };
}
