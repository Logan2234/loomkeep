import type { UserSummaryDto } from "@loomkeep/shared";
import type { PrismaService } from "../prisma/prisma.service";
import { computeStreaksByUser } from "./video-temporal.util";

// A streak longer than this is astronomically unlikely and not worth the
// query cost of fetching a user's whole watch history just to badge a
// pseudo — comfortably covers any real streak (well over a year).
const STREAK_LOOKBACK_DAYS = 400;

/**
 * Fetches + batches a consecutive-day watch streak for many users in one
 * query — used for the small streak badge next to pseudos in reviews and
 * comments (see `ProfileService.computeActivityStats` for the richer,
 * single-user version shown on the profile itself).
 */
export async function fetchStreaksByUser(
  prisma: PrismaService,
  userIds: string[],
  now: Date = new Date(),
): Promise<Map<string, number>> {
  if (userIds.length === 0) return new Map();

  const since = new Date(
    now.getTime() - STREAK_LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
  );
  const watches = await prisma.episodeWatch.findMany({
    where: { userId: { in: userIds }, watchedAt: { gte: since } },
    select: { userId: true, watchedAt: true },
  });

  return computeStreaksByUser(watches, now);
}

/**
 * Attaches an author's streak to their summary. A Figurant's derived pseudonym
 * carries no badge — the streak would leak activity the anonymisation hides.
 */
export function withStreakDays(
  author: UserSummaryDto,
  streaks: Map<string, number>,
): UserSummaryDto {
  return author.anonymized
    ? author
    : { ...author, streakDays: streaks.get(author.id) };
}
