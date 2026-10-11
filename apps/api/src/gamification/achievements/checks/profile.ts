import type { PrismaService } from "../../../prisma/prisma.service";

import type { AchievementCheckResult } from "../types";
import { DAY_MS, MEDIA_OWNERSHIP_STATUSES } from "./shared";

export async function checkLockedDown(
  prisma: PrismaService,
  userId: string,
): Promise<AchievementCheckResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { mfaTotpEnabled: true },
  });
  return { unlocked: user?.mfaTotpEnabled === true };
}

/** "member_since" tiers: account age in days (1 month / 1 year / 5 years). */
export function checkMemberSinceTier(days: number) {
  return async (
    prisma: PrismaService,
    userId: string,
  ): Promise<AchievementCheckResult> => {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { createdAt: true },
    });
    if (!user) return { unlocked: false };
    const elapsedDays = Math.floor(
      (Date.now() - user.createdAt.getTime()) / DAY_MS,
    );
    return {
      unlocked: elapsedDays >= days,
      progress: { current: Math.min(elapsedDays, days), target: days },
    };
  };
}

export async function checkFreshStart(
  prisma: PrismaService,
  userId: string,
): Promise<AchievementCheckResult> {
  const run = await prisma.importRun.findFirst({
    where: { userId, status: "SUCCESS" },
    select: { id: true },
  });
  return { unlocked: run !== null };
}

export async function checkProfileComplete(
  prisma: PrismaService,
  userId: string,
): Promise<AchievementCheckResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { avatar: true, bio: true },
  });
  const unlocked = !!user?.avatar && !!user.bio?.trim();
  return { unlocked };
}

/**
 * "no_favorites" (secret): 100+ titles tracked across every domain, none of
 * them ever favorited.
 */
export async function checkNoFavorites(
  prisma: PrismaService,
  userId: string,
): Promise<AchievementCheckResult> {
  const [
    mediaTotal,
    gameTotal,
    bookTotal,
    musicTotal,
    mediaFav,
    gameFav,
    bookFav,
    musicFav,
  ] = await Promise.all([
    prisma.libraryEntry.count({ where: { userId } }),
    prisma.gameEntry.count({ where: { userId } }),
    prisma.bookEntry.count({ where: { userId } }),
    prisma.musicEntry.count({ where: { userId } }),
    prisma.libraryEntry.count({ where: { userId, favorite: true } }),
    prisma.gameEntry.count({ where: { userId, favorite: true } }),
    prisma.bookEntry.count({ where: { userId, favorite: true } }),
    prisma.musicEntry.count({ where: { userId, favorite: true } }),
  ]);
  const total = mediaTotal + gameTotal + bookTotal + musicTotal;
  const favorited = mediaFav + gameFav + bookFav + musicFav;
  return { unlocked: total >= 100 && favorited === 0 };
}

/**
 * "full_inventory": every MediaOwnershipStatus value used at least once.
 * Scoped to the MEDIA domain — GAMES/BOOKS/MUSIC each have their own,
 * differently-shaped ownership enum (see schema.prisma), so a single
 * transversal "every status across every domain" reading doesn't have one
 * coherent target set.
 */
export async function checkFullInventory(
  prisma: PrismaService,
  userId: string,
): Promise<AchievementCheckResult> {
  const rows = await prisma.libraryEntry.findMany({
    where: { userId, ownershipStatus: { not: "NONE" } },
    select: { ownershipStatus: true },
    distinct: ["ownershipStatus"],
  });
  const covered = new Set<string>(rows.map((r) => r.ownershipStatus));
  const current = MEDIA_OWNERSHIP_STATUSES.filter((s) => covered.has(s)).length;
  return {
    unlocked: current === MEDIA_OWNERSHIP_STATUSES.length,
    progress: { current, target: MEDIA_OWNERSHIP_STATUSES.length },
  };
}

/** "guilty_pleasure": a whole series/anime completed, rated 1-3 by the user. */
export async function checkGuiltyPleasure(
  prisma: PrismaService,
  userId: string,
): Promise<AchievementCheckResult> {
  const entries = await prisma.libraryEntry.findMany({
    where: {
      userId,
      status: "COMPLETED",
      mediaItem: { type: { in: ["SERIES", "ANIME"] } },
    },
    select: { mediaItemId: true },
  });
  if (entries.length === 0) return { unlocked: false };

  const review = await prisma.review.findFirst({
    where: {
      userId,
      targetType: "MEDIA",
      targetId: { in: entries.map((e) => e.mediaItemId) },
      rating: { gte: 1, lte: 3 },
    },
    select: { id: true },
  });
  return { unlocked: review !== null };
}

/** "hidden_gem": a tracked title (any domain) that no other user has tracked. */
export async function checkHiddenGem(
  prisma: PrismaService,
  userId: string,
): Promise<AchievementCheckResult> {
  const [mediaEntries, gameEntries, bookEntries] = await Promise.all([
    prisma.libraryEntry.findMany({
      where: { userId },
      select: { mediaItemId: true },
    }),
    prisma.gameEntry.findMany({
      where: { userId },
      select: { gameItemId: true },
    }),
    prisma.bookEntry.findMany({
      where: { userId },
      select: { bookItemId: true },
    }),
  ]);

  for (const { mediaItemId } of mediaEntries) {
    const count = await prisma.libraryEntry.count({ where: { mediaItemId } });
    if (count === 1) return { unlocked: true };
  }

  for (const { gameItemId } of gameEntries) {
    const count = await prisma.gameEntry.count({ where: { gameItemId } });
    if (count === 1) return { unlocked: true };
  }

  for (const { bookItemId } of bookEntries) {
    const count = await prisma.bookEntry.count({ where: { bookItemId } });
    if (count === 1) return { unlocked: true };
  }

  return { unlocked: false };
}
