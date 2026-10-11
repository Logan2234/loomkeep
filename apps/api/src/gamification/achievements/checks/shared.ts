import { XpReason } from "@loomkeep/shared";

import { localParts } from "../../../common/local-day.util";

import type { PrismaService } from "../../../prisma/prisma.service";

import { decadeOf } from "../../../stats/decade.util";

import type { AchievementCheckResult } from "../types";

export function knownWatchDates(watches: { watchedAt: Date | null }[]): Date[] {
  return watches.flatMap(({ watchedAt }) => (watchedAt ? [watchedAt] : []));
}

// Grouped by query family rather than declared one by one: most families are
// a single count/distinct query parameterised by
// threshold, mirroring checkCinephileTier.

/** Generic "count reaches target" tier, shared by every simple volume family. */
export function checkCountTier(
  count: (prisma: PrismaService, userId: string) => Promise<number>,
  target: number,
) {
  return async (
    prisma: PrismaService,
    userId: string,
  ): Promise<AchievementCheckResult> => {
    const current = await count(prisma, userId);
    return { unlocked: current >= target, progress: { current, target } };
  };
}

export const checkSeriesFinisherTier = (target: number) =>
  checkCountTier(
    (prisma, userId) =>
      prisma.libraryEntry.count({
        where: {
          userId,
          status: "COMPLETED",
          mediaItem: { type: { in: ["SERIES", "ANIME"] } },
        },
      }),
    target,
  );

export const checkBookFinisherTier = (target: number) =>
  checkCountTier(
    (prisma, userId) =>
      prisma.bookEntry.count({ where: { userId, status: "READ" } }),
    target,
  );

export const checkGameFinisherTier = (target: number) =>
  checkCountTier(
    (prisma, userId) =>
      prisma.gameEntry.count({ where: { userId, status: "COMPLETED" } }),
    target,
  );

export const DAY_MS = 24 * 60 * 60 * 1000;

/** Sagas completed while tracked here (SAGA_COMPLETED), every domain together. */
export const checkSagaFinisherTier = (target: number) =>
  checkCountTier(
    (prisma, userId) =>
      prisma.xpEntry.count({
        where: { userId, reason: XpReason.SAGA_COMPLETED, revokedAt: null },
      }),
    target,
  );

/** Pages of every book finished, as catalogued — one without a known count adds none. */
export const checkPagesReaderTier = (target: number) =>
  checkCountTier(async (prisma, userId) => {
    const pages = await prisma.bookItem.aggregate({
      where: { entries: { some: { userId, status: "READ" } } },
      _sum: { pageCount: true },
    });
    return pages._sum.pageCount ?? 0;
  }, target);

/**
 * Hours played across every game: its own playtime (sessions, a Steam sync)
 * or, for a game finished without any, IGDB's average time to beat — so a
 * player who logs nothing but their finishes still counts what games take.
 */
export const checkHoursPlayedTier = (target: number) =>
  checkCountTier(async (prisma, userId) => {
    const entries = await prisma.gameEntry.findMany({
      where: { userId },
      select: {
        status: true,
        playtimeMinutes: true,
        gameItem: { select: { timeToBeatNormallyMin: true } },
      },
    });
    const minutes = entries.reduce(
      (sum, e) =>
        sum +
        Math.max(
          e.playtimeMinutes,
          e.status === "COMPLETED"
            ? (e.gameItem.timeToBeatNormallyMin ?? 0)
            : 0,
        ),
      0,
    );
    return Math.floor(minutes / 60);
  }, target);

// How many times one work must be finished for the "loyal" achievements.
export const LOYAL_TIMES = 3;

/**
 * Every timestamp that counts as "a movie watched" — first completion plus
 * rewatches — optionally narrowed by an extra MediaItem filter (e.g. genre).
 * Used by night_owl/early_bird (hour window) and halloween (month window),
 * alongside each caller's own EpisodeWatch query (episodes need their own
 * genre path through Season/MediaItem, so they aren't folded in here).
 */
export async function movieWatchTimestamps(
  prisma: PrismaService,
  userId: string,
  movieWhere: Record<string, unknown> = {},
  since?: Date,
): Promise<Date[]> {
  const [movieFirstWatches, movieReplays] = await Promise.all([
    prisma.libraryEntry.findMany({
      where: {
        userId,
        finishedAt: since ? { gte: since } : { not: null },
        mediaItem: { type: "MOVIE", ...movieWhere },
      },
      select: { finishedAt: true },
    }),
    prisma.movieReplay.findMany({
      where: {
        ...(since ? { finishedAt: { gte: since } } : {}),
        libraryEntry: { userId, mediaItem: { type: "MOVIE", ...movieWhere } },
      },
      select: { finishedAt: true },
    }),
  ]);

  return [
    ...movieFirstWatches
      .map((w) => w.finishedAt)
      .filter((date): date is Date => date !== null),
    ...movieReplays.map((w) => w.finishedAt),
  ];
}

/**
 * The behaviour achievements (night_owl, early_bird, halloween,
 * new_year_finish, welcome_back, worth_the_wait) only read activity dated
 * after the account was created: an imported history tells of habits kept
 * elsewhere, and would unlock them all the day it lands.
 */
export async function behaviourUser(prisma: PrismaService, userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { timezone: true, createdAt: true },
  });
}

/** Shared core of night_owl/early_bird — a watch whose local hour falls in [startHour, endHour). */
export function checkHourWindow(startHour: number, endHour: number) {
  return async (
    prisma: PrismaService,
    userId: string,
  ): Promise<AchievementCheckResult> => {
    const user = await behaviourUser(prisma, userId);
    if (!user) return { unlocked: false };

    const [episodeWatches, movieDates] = await Promise.all([
      prisma.episodeWatch.findMany({
        where: { userId, watchedAt: { gte: user.createdAt } },
        select: { watchedAt: true },
      }),
      movieWatchTimestamps(prisma, userId, {}, user.createdAt),
    ]);
    const dates = [...knownWatchDates(episodeWatches), ...movieDates];
    const unlocked = dates.some((d) => {
      const parts = localParts(user.timezone, d);
      return parts !== null && parts.hour >= startHour && parts.hour < endHour;
    });
    return { unlocked };
  };
}

/** Distinct release decades across every domain the user has tracked (any status). */
export async function distinctDecades(
  prisma: PrismaService,
  userId: string,
): Promise<number> {
  const [media, games, books] = await Promise.all([
    prisma.libraryEntry.findMany({
      where: { userId },
      select: { mediaItem: { select: { releaseDate: true } } },
    }),
    prisma.gameEntry.findMany({
      where: { userId },
      select: { gameItem: { select: { releaseDate: true } } },
    }),
    prisma.bookEntry.findMany({
      where: { userId },
      select: { bookItem: { select: { releaseDate: true } } },
    }),
  ]);

  const decades = new Set<number>();
  for (const e of media)
    if (e.mediaItem.releaseDate) decades.add(decadeOf(e.mediaItem.releaseDate));
  for (const e of games)
    if (e.gameItem.releaseDate) decades.add(decadeOf(e.gameItem.releaseDate));
  for (const e of books)
    if (e.bookItem.releaseDate) decades.add(decadeOf(e.bookItem.releaseDate));
  return decades.size;
}

/**
 * Distinct genres across every domain the user has tracked (any status).
 *
 * Thresholds here are high (25/75/150) because this set is not a curated
 * taxonomy: TMDB and IGDB ship a couple dozen genres each, but Open Library
 * contributes free-form *subjects*, so a book-heavy library crosses a
 * hundred distinct values without being especially diverse. Narrowing this
 * to media/games would improve comparability but ignore books entirely.
 */
export async function distinctGenres(
  prisma: PrismaService,
  userId: string,
): Promise<number> {
  const [media, games, books] = await Promise.all([
    prisma.libraryEntry.findMany({
      where: { userId },
      select: { mediaItem: { select: { genres: true } } },
    }),
    prisma.gameEntry.findMany({
      where: { userId },
      select: { gameItem: { select: { genres: true } } },
    }),
    prisma.bookEntry.findMany({
      where: { userId },
      select: { bookItem: { select: { genres: true } } },
    }),
  ]);

  const genres = new Set<string>();
  for (const e of media) for (const g of e.mediaItem.genres) genres.add(g);
  for (const e of games) for (const g of e.gameItem.genres) genres.add(g);
  for (const e of books) for (const g of e.bookItem.genres) genres.add(g);
  return genres.size;
}

// MediaItem.genres is denormalised from TMDB at whatever locale was active
// when the item was first cached (regionalLocale, via tmdb.provider.ts — "fr" or
// "en"), so a single library can mix "Horror" and "Horreur" across items.
// Match both rather than assuming one locale.
export const HORROR_GENRES = ["Horror", "Horreur"];

export async function followSets(
  prisma: PrismaService,
  userId: string,
): Promise<{ following: Set<string>; followers: Set<string> }> {
  const [following, followers] = await Promise.all([
    prisma.follow.findMany({
      where: { followerId: userId, status: "ACCEPTED" },
      select: { followeeId: true },
    }),
    prisma.follow.findMany({
      where: { followeeId: userId, status: "ACCEPTED" },
      select: { followerId: true },
    }),
  ]);
  return {
    following: new Set(following.map((f) => f.followeeId)),
    followers: new Set(followers.map((f) => f.followerId)),
  };
}

// Every non-NONE MediaOwnershipStatus value — see checkFullInventory's doc
// comment for why this is scoped to the MEDIA domain.
export const MEDIA_OWNERSHIP_STATUSES = [
  "PHYSICAL",
  "DIGITAL",
  "STREAMING",
  "BORROWED",
];
