import type { PrismaService } from "../prisma/prisma.service";

/**
 * Every moment the user did something an activity streak counts: a dated
 * watch (TMDB specials aside), a game session or a reading session.
 */
export async function activityDates(
  prisma: PrismaService,
  userId: string,
): Promise<Date[]> {
  const [watches, gameSessions, bookSessions] = await Promise.all([
    prisma.episodeWatch.findMany({
      where: {
        userId,
        watchedAt: { not: null },
        episode: { season: { number: { not: 0 } } },
      },
      select: { watchedAt: true },
    }),
    prisma.gameSession.findMany({
      where: { gameEntry: { userId } },
      select: { occurredAt: true },
    }),
    prisma.bookSession.findMany({
      where: { bookEntry: { userId } },
      select: { occurredAt: true },
    }),
  ]);

  return [
    ...watches.flatMap((w) => (w.watchedAt ? [w.watchedAt] : [])),
    ...gameSessions.map((session) => session.occurredAt),
    ...bookSessions.map((session) => session.occurredAt),
  ];
}
