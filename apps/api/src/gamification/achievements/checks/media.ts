import { utcYearRange } from "../../../common/date.util";

import { localDay } from "../../../common/local-day.util";

import type { PrismaService } from "../../../prisma/prisma.service";

import { computeOnboardingDoneMap } from "../../onboarding/onboarding.util";
import type { AchievementCheckResult } from "../types";
import {
  checkCountTier,
  distinctDecades,
  distinctGenres,
  knownWatchDates,
} from "./shared";

/** "first_episode": at least one EpisodeWatch exists for the user. */
export async function checkFirstEpisode(
  prisma: PrismaService,
  userId: string,
): Promise<AchievementCheckResult> {
  const watch = await prisma.episodeWatch.findFirst({
    where: { userId },
    select: { id: true },
  });
  return { unlocked: watch !== null };
}

/**
 * Shared core of the three "cinephile" tiers — only the threshold differs.
 * Movies watched = LibraryEntry rows at status COMPLETED whose MediaItem is
 * type MOVIE.
 */
export function checkCinephileTier(target: number) {
  return async (
    prisma: PrismaService,
    userId: string,
  ): Promise<AchievementCheckResult> => {
    const current = await prisma.libraryEntry.count({
      where: { userId, status: "COMPLETED", mediaItem: { type: "MOVIE" } },
    });
    return { unlocked: current >= target, progress: { current, target } };
  };
}

export const checkEpisodeWatcherTier = (target: number) =>
  checkCountTier(
    (prisma, userId) => prisma.episodeWatch.count({ where: { userId } }),
    target,
  );

/** "marathon": 10+ episodes watched on the same local calendar day. */
export async function checkMarathon(
  prisma: PrismaService,
  userId: string,
): Promise<AchievementCheckResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { timezone: true },
  });
  if (!user) return { unlocked: false };

  const watches = await prisma.episodeWatch.findMany({
    where: { userId },
    select: { watchedAt: true },
  });

  const perDay = new Map<string, number>();

  for (const watchedAt of knownWatchDates(watches)) {
    const day = localDay(user.timezone, watchedAt);
    if (!day) continue;
    perDay.set(day, (perDay.get(day) ?? 0) + 1);
  }

  const max = perDay.size === 0 ? 0 : Math.max(...perDay.values());
  return { unlocked: max >= 10 };
}

export function checkDecadesTier(target: number) {
  return async (
    prisma: PrismaService,
    userId: string,
  ): Promise<AchievementCheckResult> => {
    const current = await distinctDecades(prisma, userId);
    return { unlocked: current >= target, progress: { current, target } };
  };
}

export function checkGenresTier(target: number) {
  return async (
    prisma: PrismaService,
    userId: string,
  ): Promise<AchievementCheckResult> => {
    const current = await distinctGenres(prisma, userId);
    return { unlocked: current >= target, progress: { current, target } };
  };
}

/** "omnivore": at least one tracked title (any status) in every one of the 4 tracked domains. */
export async function checkOmnivore(
  prisma: PrismaService,
  userId: string,
): Promise<AchievementCheckResult> {
  const [media, games, books, music] = await Promise.all([
    prisma.libraryEntry.count({ where: { userId } }),
    prisma.gameEntry.count({ where: { userId } }),
    prisma.bookEntry.count({ where: { userId } }),
    prisma.musicEntry.count({ where: { userId } }),
  ]);
  const current = [media, games, books, music].filter((c) => c > 0).length;
  return { unlocked: current === 4, progress: { current, target: 4 } };
}

/** "big_screen": 5+ series/anime, with 5+ real seasons (season 0 excluded), COMPLETED. */
export async function checkBigScreen(
  prisma: PrismaService,
  userId: string,
): Promise<AchievementCheckResult> {
  const entries = await prisma.libraryEntry.findMany({
    where: {
      userId,
      status: "COMPLETED",
      mediaItem: { type: { in: ["SERIES", "ANIME"] } },
    },
    select: {
      mediaItem: {
        select: {
          seasons: { where: { number: { gt: 0 } }, select: { id: true } },
        },
      },
    },
  });
  const current = entries.filter((e) => e.mediaItem.seasons.length >= 5).length;
  return { unlocked: current >= 5, progress: { current, target: 5 } };
}

/**
 * "well_rounded": 10+ finished titles in each of MEDIA/GAMES/BOOKS/MUSIC.
 */
export async function checkWellRounded(
  prisma: PrismaService,
  userId: string,
): Promise<AchievementCheckResult> {
  const [media, games, books, music] = await Promise.all([
    prisma.libraryEntry.count({ where: { userId, status: "COMPLETED" } }),
    prisma.gameEntry.count({ where: { userId, status: "COMPLETED" } }),
    prisma.bookEntry.count({ where: { userId, status: "READ" } }),
    prisma.musicEntry.count({ where: { userId, status: "LISTENED" } }),
  ]);
  const current = [media, games, books, music].filter((c) => c >= 10).length;
  return { unlocked: current >= 4, progress: { current, target: 4 } };
}

/** "contemporary": a completed movie released the same year as the user's own birth year. */
export async function checkContemporary(
  prisma: PrismaService,
  userId: string,
): Promise<AchievementCheckResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { birthDate: true },
  });
  if (!user?.birthDate) return { unlocked: false };

  const birthYear = user.birthDate.getUTCFullYear();
  const match = await prisma.libraryEntry.findFirst({
    where: {
      userId,
      status: "COMPLETED",
      mediaItem: {
        type: "MOVIE",
        releaseDate: utcYearRange(birthYear),
      },
    },
    select: { id: true },
  });
  return { unlocked: match !== null };
}

/**
 * "premiere_seance" (G8): every applicable step of the gamified onboarding
 * checklist is done or skipped. Reuses `computeOnboardingDoneMap` — the
 * exact function `OnboardingService` itself calls — plus the user's stored
 * `onboardingSkippedSteps`, so this check and the checklist the user sees
 * can never disagree on what counts as finished. A social step that never
 * applied on this deployment is already recorded as skipped by
 * `OnboardingService` before this ever runs, so this needs no feature-flag
 * awareness of its own.
 */
export async function checkPremiereSeance(
  prisma: PrismaService,
  userId: string,
): Promise<AchievementCheckResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { onboardingSkippedSteps: true },
  });
  const doneMap = await computeOnboardingDoneMap(prisma, userId);
  const unlocked = Object.entries(doneMap).every(
    ([key, done]) => done || (user?.onboardingSkippedSteps ?? []).includes(key),
  );
  return { unlocked };
}
