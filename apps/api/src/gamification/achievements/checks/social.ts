import type { PrismaService } from "../../../prisma/prisma.service";

import type { AchievementCheckResult } from "../types";
import { checkCountTier, followSets } from "./shared";

export async function checkFirstComment(
  prisma: PrismaService,
  userId: string,
): Promise<AchievementCheckResult> {
  const comment = await prisma.comment.findFirst({
    where: { authorId: userId, deletedAt: null },
    select: { id: true },
  });
  return { unlocked: comment !== null };
}

export const checkChatterboxTier = (target: number) =>
  checkCountTier(
    (prisma, userId) =>
      prisma.comment.count({ where: { authorId: userId, deletedAt: null } }),
    target,
  );

/** "crowd_favorite": 20+ total UP votes received across all of the user's reviews. */
export async function checkCrowdFavorite(
  prisma: PrismaService,
  userId: string,
): Promise<AchievementCheckResult> {
  const current = await prisma.reviewVote.count({
    where: { value: "UP", review: { userId } },
  });
  return { unlocked: current >= 20, progress: { current, target: 20 } };
}

/** "standing_ovation": 20+ UP votes on a single review. */
export async function checkStandingOvation(
  prisma: PrismaService,
  userId: string,
): Promise<AchievementCheckResult> {
  const grouped = await prisma.reviewVote.groupBy({
    by: ["reviewId"],
    where: { value: "UP", review: { userId } },
    _count: { _all: true },
  });
  const current = grouped.reduce((max, g) => Math.max(max, g._count._all), 0);
  return { unlocked: current >= 20, progress: { current, target: 20 } };
}

export async function checkFirstList(
  prisma: PrismaService,
  userId: string,
): Promise<AchievementCheckResult> {
  const list = await prisma.list.findFirst({
    where: { userId, visibility: { not: "PRIVATE" } },
    select: { id: true },
  });
  return { unlocked: list !== null };
}

export const checkCuratorTier = (target: number) =>
  checkCountTier(
    (prisma, userId) => prisma.list.count({ where: { userId } }),
    target,
  );

export const checkFollowersTier = (target: number) =>
  checkCountTier(
    (prisma, userId) =>
      prisma.follow.count({
        where: { followeeId: userId, status: "ACCEPTED" },
      }),
    target,
  );

/** "has_friends": at least one reciprocal (mutual) accepted follow. */
export async function checkHasFriends(
  prisma: PrismaService,
  userId: string,
): Promise<AchievementCheckResult> {
  const { following, followers } = await followSets(prisma, userId);
  const unlocked = [...following].some((id) => followers.has(id));
  return { unlocked };
}

/** "one_sided" (secret): follows someone who doesn't follow back. */
export async function checkOneSided(
  prisma: PrismaService,
  userId: string,
): Promise<AchievementCheckResult> {
  const { following, followers } = await followSets(prisma, userId);
  const unlocked = [...following].some((id) => !followers.has(id));
  return { unlocked };
}

/** "double_life": currently a Figurant (GHOST), but has at least one Review or Comment. */
export async function checkDoubleLife(
  prisma: PrismaService,
  userId: string,
): Promise<AchievementCheckResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { profileAccess: true },
  });
  if (user?.profileAccess !== "GHOST") return { unlocked: false };

  const [review, comment] = await Promise.all([
    prisma.review.findFirst({ where: { userId }, select: { id: true } }),
    prisma.comment.findFirst({
      where: { authorId: userId, deletedAt: null },
      select: { id: true },
    }),
  ]);
  return { unlocked: review !== null || comment !== null };
}

/** "icebreaker": the user's comment is the earliest comment on at least one target. */
export async function checkIcebreaker(
  prisma: PrismaService,
  userId: string,
): Promise<AchievementCheckResult> {
  const mine = await prisma.comment.findMany({
    where: { authorId: userId, deletedAt: null },
    select: { targetId: true },
    distinct: ["targetId"],
  });

  for (const { targetId } of mine) {
    const earliest = await prisma.comment.findFirst({
      where: { targetId, deletedAt: null },
      orderBy: { createdAt: "asc" },
      select: { authorId: true },
    });
    if (earliest?.authorId === userId) return { unlocked: true };
  }

  return { unlocked: false };
}

/** "first_take": the user's review is the earliest review on at least one target. */
export async function checkFirstTake(
  prisma: PrismaService,
  userId: string,
): Promise<AchievementCheckResult> {
  const mine = await prisma.review.findMany({
    where: { userId },
    select: { targetId: true },
  });

  for (const { targetId } of mine) {
    const earliest = await prisma.review.findFirst({
      where: { targetId },
      orderBy: { createdAt: "asc" },
      select: { userId: true },
    });
    if (earliest?.userId === userId) return { unlocked: true };
  }

  return { unlocked: false };
}

/**
 * "curious_cat": clicked the version-number link (home/settings). The one
 * event-granted entry of the catalogue — the click leaves no trace anywhere
 * in the data model, so there is no state to derive it from. It is unlocked
 * directly by AchievementService.markVersionLinkClicked (POST
 * /achievements/signals/version-link), and the UserAchievement row is the
 * record that it happened.
 *
 * Always false here on purpose: evaluateOne only ever calls check() on an
 * achievement that is not yet unlocked, so returning false keeps the nightly
 * sweep from ever granting this one on its own.
 */
export async function checkCuriousCat(): Promise<AchievementCheckResult> {
  return { unlocked: false };
}
