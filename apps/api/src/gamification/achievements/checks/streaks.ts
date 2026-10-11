import type { PrismaService } from "../../../prisma/prisma.service";

import { computeStreak } from "../../../stats/video-temporal.util";

import type { AchievementCheckResult } from "../types";
import {
  behaviourUser,
  checkHourWindow,
  DAY_MS,
  knownWatchDates,
} from "./shared";
export const checkNightOwl = checkHourWindow(2, 4);

export const checkEarlyBird = checkHourWindow(5, 7);

/**
 * Streak tiers reuse `computeStreak` from `stats/video-temporal.util.ts` — the
 * same cross-domain streak the profile already shows, so a
 * badge can never disagree with the number displayed next to it.
 */
export function checkStreakTier(target: number) {
  return async (
    prisma: PrismaService,
    userId: string,
  ): Promise<AchievementCheckResult> => {
    const [watches, gameSessions, bookSessions] = await Promise.all([
      prisma.episodeWatch.findMany({
        where: { userId },
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
    const current = computeStreak([
      ...knownWatchDates(watches),
      ...gameSessions.map((session) => session.occurredAt),
      ...bookSessions.map((session) => session.occurredAt),
    ]);
    return { unlocked: current >= target, progress: { current, target } };
  };
}

/** "welcome_back": a 6+ month (182 days) gap somewhere between two episode watches. */
export async function checkWelcomeBack(
  prisma: PrismaService,
  userId: string,
): Promise<AchievementCheckResult> {
  const user = await behaviourUser(prisma, userId);
  if (!user) return { unlocked: false };

  const watches = await prisma.episodeWatch.findMany({
    where: { userId, watchedAt: { gte: user.createdAt } },
    select: { watchedAt: true },
    orderBy: { watchedAt: "asc" },
  });

  const GAP_MS = 182 * DAY_MS;

  const dates = knownWatchDates(watches);

  for (let i = 1; i < dates.length; i++) {
    if (dates[i].getTime() - dates[i - 1].getTime() >= GAP_MS) {
      return { unlocked: true };
    }
  }

  return { unlocked: false };
}
