import { localDay } from "../../../common/local-day.util";

import type { PrismaService } from "../../../prisma/prisma.service";

import type { AchievementCheckResult } from "../types";
import {
  behaviourUser,
  HORROR_GENRES,
  knownWatchDates,
  movieWatchTimestamps,
} from "./shared";

/** "halloween": a horror movie/episode watched in October (UTC month, like decadeOf/computeDecadeHistogram elsewhere). */
export async function checkHalloween(
  prisma: PrismaService,
  userId: string,
): Promise<AchievementCheckResult> {
  const user = await behaviourUser(prisma, userId);
  if (!user) return { unlocked: false };

  const [horrorEpisodeWatches, horrorMovieDates] = await Promise.all([
    prisma.episodeWatch.findMany({
      where: {
        userId,
        watchedAt: { gte: user.createdAt },
        episode: {
          season: { mediaItem: { genres: { hasSome: HORROR_GENRES } } },
        },
      },
      select: { watchedAt: true },
    }),
    movieWatchTimestamps(
      prisma,
      userId,
      { genres: { hasSome: HORROR_GENRES } },
      user.createdAt,
    ),
  ]);
  const all = [...knownWatchDates(horrorEpisodeWatches), ...horrorMovieDates];
  const unlocked = all.some((d) => d.getUTCMonth() === 9); // October
  return { unlocked };
}

/** "new_year_finish" (secret): a work finished on January 1st, local time. */
export async function checkNewYearFinish(
  prisma: PrismaService,
  userId: string,
): Promise<AchievementCheckResult> {
  const user = await behaviourUser(prisma, userId);
  if (!user) return { unlocked: false };

  const where = { userId, finishedAt: { gte: user.createdAt } };
  const [media, games, books] = await Promise.all([
    prisma.libraryEntry.findMany({ where, select: { finishedAt: true } }),
    prisma.gameEntry.findMany({ where, select: { finishedAt: true } }),
    prisma.bookEntry.findMany({ where, select: { finishedAt: true } }),
  ]);

  const dates = [...media, ...games, ...books]
    .map((r) => r.finishedAt)
    .filter((date): date is Date => date !== null);
  const unlocked = dates.some((d) => {
    const day = localDay(user.timezone, d);
    return day !== null && day.endsWith("-01-01");
  });
  return { unlocked };
}

/** "anniversary": some activity logged on the same month/day as account creation, a later year. */
export async function checkAnniversary(
  prisma: PrismaService,
  userId: string,
): Promise<AchievementCheckResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { createdAt: true, timezone: true },
  });
  if (!user) return { unlocked: false };

  const createdDay = localDay(user.timezone, user.createdAt);
  if (!createdDay) return { unlocked: false };
  const monthDay = createdDay.slice(5);

  const [watches, comments, reviews] = await Promise.all([
    prisma.episodeWatch.findMany({
      where: { userId },
      select: { watchedAt: true },
    }),
    prisma.comment.findMany({
      where: { authorId: userId },
      select: { createdAt: true },
    }),
    prisma.review.findMany({ where: { userId }, select: { createdAt: true } }),
  ]);

  const dates = [
    ...knownWatchDates(watches),
    ...comments.map((c) => c.createdAt),
    ...reviews.map((r) => r.createdAt),
  ];

  const unlocked = dates.some((d) => {
    const day = localDay(user.timezone, d);
    return day !== null && day !== createdDay && day.slice(5) === monthDay;
  });
  return { unlocked };
}
