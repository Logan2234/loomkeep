import { XpReason } from "@loomkeep/shared";
import { localDay, localParts } from "../../common/local-day.util";
import type { PrismaService } from "../../prisma/prisma.service";
import { decadeOf } from "../../stats/decade.util";
import { computeStreak } from "../../stats/video-temporal.util";

export interface AchievementCheckResult {
  unlocked: boolean;
  // Present only for achievements with a progression bar (tiered or
  // single-target) — omitted for simple on/off achievements.
  progress?: { current: number; target: number };
}

/**
 * One declarative registry entry: what unlocks it, what it grants, and
 * optional metadata for later tickets. Mirrors XP_RULES/XP_RULE_LIST's
 * shape (see xp-rules.ts) — a single lookup-by-key registry, plus an array
 * for iteration.
 */
export interface AchievementDefinition {
  key: string;
  // XP credited via XpReason.ACHIEVEMENT_UNLOCKED when this unlocks — varies
  // by rarity, see xp-rules.ts's note on this reason. Passed as
  // XpService.award's amountOverride — this reason has no fixed amount in
  // the barème registry.
  xpAward: number;
  // A tiered achievement is modelled as several registry entries sharing
  // this root (e.g. "cinephile" for cinephile_bronze/_silver/_gold) — for
  // display grouping later (G3/G5), not used by the engine itself in this
  // ticket.
  tierOf?: string;
  // [G3]: the slot shows even before unlock, the name/description stay
  // hidden until then (enforced by the G5 screen, not here).
  secret?: boolean;
  // [G3]: mirrors XpRule.socialGated — set on the whole "Social" family.
  socialGated?: boolean;
  check(prisma: PrismaService, userId: string): Promise<AchievementCheckResult>;
}

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
 * type MOVIE (see the [G2] plan's MVP catalogue).
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

// --- [G3]: the real catalogue -------------------------------------------
//
// Grouped by query family rather than declared one-by-one, per the [G3]
// plan — most families are a single count/distinct query parameterised by
// threshold, mirroring checkCinephileTier above.

/** Generic "count reaches target" tier, shared by every simple volume family. */
function checkCountTier(
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

// --- Volume (per domain) ---

export const checkEpisodeWatcherTier = (target: number) =>
  checkCountTier(
    (prisma, userId) => prisma.episodeWatch.count({ where: { userId } }),
    target,
  );

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

// --- Rituel ---

const DAY_MS = 24 * 60 * 60 * 1000;

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

  for (const w of watches) {
    const day = localDay(user.timezone, w.watchedAt);
    if (!day) continue;
    perDay.set(day, (perDay.get(day) ?? 0) + 1);
  }

  const max = perDay.size === 0 ? 0 : Math.max(...perDay.values());
  return { unlocked: max >= 10 };
}

/**
 * Every timestamp that counts as "a movie watched" — first completion plus
 * rewatches — optionally narrowed by an extra MediaItem filter (e.g. genre).
 * Used by night_owl/early_bird (hour window) and halloween (month window),
 * alongside each caller's own EpisodeWatch query (episodes need their own
 * genre path through Season/MediaItem, so they aren't folded in here).
 */
async function movieWatchTimestamps(
  prisma: PrismaService,
  userId: string,
  movieWhere: Record<string, unknown> = {},
): Promise<Date[]> {
  const [movieFirstWatches, movieReplays] = await Promise.all([
    prisma.libraryEntry.findMany({
      where: {
        userId,
        finishedAt: { not: null },
        mediaItem: { type: "MOVIE", ...movieWhere },
      },
      select: { finishedAt: true },
    }),
    prisma.movieReplay.findMany({
      where: {
        libraryEntry: { userId, mediaItem: { type: "MOVIE", ...movieWhere } },
      },
      select: { finishedAt: true },
    }),
  ]);

  return [
    ...movieFirstWatches.map((w) => w.finishedAt!),
    ...movieReplays.map((w) => w.finishedAt),
  ];
}

/** Shared core of night_owl/early_bird — a watch whose local hour falls in [startHour, endHour). */
function checkHourWindow(startHour: number, endHour: number) {
  return async (
    prisma: PrismaService,
    userId: string,
  ): Promise<AchievementCheckResult> => {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });
    if (!user) return { unlocked: false };

    const [episodeWatches, movieDates] = await Promise.all([
      prisma.episodeWatch.findMany({
        where: { userId },
        select: { watchedAt: true },
      }),
      movieWatchTimestamps(prisma, userId),
    ]);
    const dates = [...episodeWatches.map((w) => w.watchedAt), ...movieDates];
    const unlocked = dates.some((d) => {
      const parts = localParts(user.timezone, d);
      return parts !== null && parts.hour >= startHour && parts.hour < endHour;
    });
    return { unlocked };
  };
}

export const checkNightOwl = checkHourWindow(2, 4);
export const checkEarlyBird = checkHourWindow(5, 7);

/**
 * Streak tiers reuse the same episode-only streak the rest of the app
 * already shows (`stats/streak.util.ts`) — see the [G3] plan's "streak
 * transversal" decision, not redesigned here.
 */
export function checkStreakTier(target: number) {
  return async (
    prisma: PrismaService,
    userId: string,
  ): Promise<AchievementCheckResult> => {
    const watches = await prisma.episodeWatch.findMany({
      where: { userId },
      select: { watchedAt: true },
    });
    const current = computeStreak(watches.map((w) => w.watchedAt));
    return { unlocked: current >= target, progress: { current, target } };
  };
}

// --- Exploration (transversal) ---

/** Distinct release decades across every domain the user has tracked (any status). */
async function distinctDecades(
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

export function checkDecadesTier(target: number) {
  return async (
    prisma: PrismaService,
    userId: string,
  ): Promise<AchievementCheckResult> => {
    const current = await distinctDecades(prisma, userId);
    return { unlocked: current >= target, progress: { current, target } };
  };
}

/** Distinct genres across every domain the user has tracked (any status). */
async function distinctGenres(
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

// --- Complétion ---

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
 * "well_rounded": 10+ finished titles in each of 4 different domains — the
 * "well_rounded" of the [G3] plan's Domain set (MEDIA/GAMES/BOOKS/MUSIC).
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

// --- Saisonnier / temporel ---

// MediaItem.genres is denormalised from TMDB at whatever locale was active
// when the item was first cached (tmdb.provider.ts's tmdbLanguage — "fr" or
// "en"), so a single library can mix "Horror" and "Horreur" across items.
// Match both rather than assuming one locale.
const HORROR_GENRES = ["Horror", "Horreur"];

/** "halloween": a horror movie/episode watched in October (UTC month, like decadeOf/computeDecadeHistogram elsewhere). */
export async function checkHalloween(
  prisma: PrismaService,
  userId: string,
): Promise<AchievementCheckResult> {
  const [horrorEpisodeWatches, horrorMovieDates] = await Promise.all([
    prisma.episodeWatch.findMany({
      where: {
        userId,
        episode: {
          season: { mediaItem: { genres: { hasSome: HORROR_GENRES } } },
        },
      },
      select: { watchedAt: true },
    }),
    movieWatchTimestamps(prisma, userId, {
      genres: { hasSome: HORROR_GENRES },
    }),
  ]);
  const all = [
    ...horrorEpisodeWatches.map((w) => w.watchedAt),
    ...horrorMovieDates,
  ];
  const unlocked = all.some((d) => d.getUTCMonth() === 9); // October
  return { unlocked };
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
        releaseDate: {
          gte: new Date(Date.UTC(birthYear, 0, 1)),
          lt: new Date(Date.UTC(birthYear + 1, 0, 1)),
        },
      },
    },
    select: { id: true },
  });
  return { unlocked: match !== null };
}

/** "new_year_finish" (secret): a work finished on January 1st, local time. */
export async function checkNewYearFinish(
  prisma: PrismaService,
  userId: string,
): Promise<AchievementCheckResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { timezone: true },
  });
  if (!user) return { unlocked: false };

  const [media, games, books] = await Promise.all([
    prisma.libraryEntry.findMany({
      where: { userId, finishedAt: { not: null } },
      select: { finishedAt: true },
    }),
    prisma.gameEntry.findMany({
      where: { userId, finishedAt: { not: null } },
      select: { finishedAt: true },
    }),
    prisma.bookEntry.findMany({
      where: { userId, finishedAt: { not: null } },
      select: { finishedAt: true },
    }),
  ]);

  const dates = [...media, ...games, ...books].map((r) => r.finishedAt!);
  const unlocked = dates.some((d) => {
    const day = localDay(user.timezone, d);
    return day !== null && day.endsWith("-01-01");
  });
  return { unlocked };
}

// --- Social (SOCIAL_ENABLED) ---

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

async function followSets(
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

// --- Compte ---

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

// --- Autres ---

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

// Every non-NONE MediaOwnershipStatus value — see checkFullInventory's doc
// comment for why this is scoped to the MEDIA domain.
const MEDIA_OWNERSHIP_STATUSES = [
  "PHYSICAL",
  "DIGITAL",
  "STREAMING",
  "BORROWED",
];

/**
 * "full_inventory": every MediaOwnershipStatus value used at least once.
 * Scoped to the MEDIA domain — GAMES/BOOKS/MUSIC each have their own,
 * differently-shaped ownership enum (see schema.prisma), so a single
 * transversal "every status across every domain" reading doesn't have one
 * coherent target set. Flagged as an implementation assumption, not
 * explicit in the [G3] plan.
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

// --- Secrets ---

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
    const replay = await prisma.gameReplay.findFirst({
      where: { gameEntryId: first.id },
      select: { id: true },
    });
    return { unlocked: replay !== null };
  }

  const replay = await prisma.bookReplay.findFirst({
    where: { bookEntryId: first.id },
    select: { id: true },
  });
  return { unlocked: replay !== null };
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
    ...watches.map((w) => w.watchedAt),
    ...comments.map((c) => c.createdAt),
    ...reviews.map((r) => r.createdAt),
  ];

  const unlocked = dates.some((d) => {
    const day = localDay(user.timezone, d);
    return day !== null && day !== createdDay && day.slice(5) === monthDay;
  });
  return { unlocked };
}

/** "welcome_back": a 6+ month (182 days) gap somewhere between two episode watches. */
export async function checkWelcomeBack(
  prisma: PrismaService,
  userId: string,
): Promise<AchievementCheckResult> {
  const watches = await prisma.episodeWatch.findMany({
    where: { userId },
    select: { watchedAt: true },
    orderBy: { watchedAt: "asc" },
  });

  const GAP_MS = 182 * DAY_MS;

  for (let i = 1; i < watches.length; i++) {
    if (
      watches[i].watchedAt.getTime() - watches[i - 1].watchedAt.getTime() >=
      GAP_MS
    ) {
      return { unlocked: true };
    }
  }

  return { unlocked: false };
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

/** "curious_cat": clicked the version-number link at least once (POST /achievements/signals/version-link). */
export async function checkCuriousCat(
  prisma: PrismaService,
  userId: string,
): Promise<AchievementCheckResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { clickedVersionLink: true },
  });
  return { unlocked: user?.clickedVersionLink === true };
}

export const ACHIEVEMENTS: Record<string, AchievementDefinition> = {
  first_episode: {
    key: "first_episode",
    xpAward: 50,
    check: checkFirstEpisode,
  },
  cinephile_bronze: {
    key: "cinephile_bronze",
    tierOf: "cinephile",
    xpAward: 50,
    check: checkCinephileTier(10),
  },
  cinephile_silver: {
    key: "cinephile_silver",
    tierOf: "cinephile",
    xpAward: 150,
    check: checkCinephileTier(50),
  },
  cinephile_gold: {
    key: "cinephile_gold",
    tierOf: "cinephile",
    xpAward: 400,
    check: checkCinephileTier(200),
  },

  // --- Volume ---
  episode_watcher_bronze: {
    key: "episode_watcher_bronze",
    tierOf: "episode_watcher",
    xpAward: 50,
    check: checkEpisodeWatcherTier(100),
  },
  episode_watcher_silver: {
    key: "episode_watcher_silver",
    tierOf: "episode_watcher",
    xpAward: 150,
    check: checkEpisodeWatcherTier(500),
  },
  episode_watcher_gold: {
    key: "episode_watcher_gold",
    tierOf: "episode_watcher",
    xpAward: 400,
    check: checkEpisodeWatcherTier(2000),
  },
  series_finisher_bronze: {
    key: "series_finisher_bronze",
    tierOf: "series_finisher",
    xpAward: 50,
    check: checkSeriesFinisherTier(10),
  },
  series_finisher_silver: {
    key: "series_finisher_silver",
    tierOf: "series_finisher",
    xpAward: 150,
    check: checkSeriesFinisherTier(30),
  },
  series_finisher_gold: {
    key: "series_finisher_gold",
    tierOf: "series_finisher",
    xpAward: 400,
    check: checkSeriesFinisherTier(75),
  },
  book_finisher_bronze: {
    key: "book_finisher_bronze",
    tierOf: "book_finisher",
    xpAward: 50,
    check: checkBookFinisherTier(10),
  },
  book_finisher_silver: {
    key: "book_finisher_silver",
    tierOf: "book_finisher",
    xpAward: 150,
    check: checkBookFinisherTier(50),
  },
  book_finisher_gold: {
    key: "book_finisher_gold",
    tierOf: "book_finisher",
    xpAward: 400,
    check: checkBookFinisherTier(150),
  },
  game_finisher_bronze: {
    key: "game_finisher_bronze",
    tierOf: "game_finisher",
    xpAward: 50,
    check: checkGameFinisherTier(10),
  },
  game_finisher_silver: {
    key: "game_finisher_silver",
    tierOf: "game_finisher",
    xpAward: 150,
    check: checkGameFinisherTier(30),
  },
  game_finisher_gold: {
    key: "game_finisher_gold",
    tierOf: "game_finisher",
    xpAward: 400,
    check: checkGameFinisherTier(75),
  },

  // --- Rituel ---
  marathon: { key: "marathon", xpAward: 150, check: checkMarathon },
  night_owl: { key: "night_owl", xpAward: 50, check: checkNightOwl },
  early_bird: { key: "early_bird", xpAward: 50, check: checkEarlyBird },
  streak_bronze: {
    key: "streak_bronze",
    tierOf: "streak",
    xpAward: 50,
    check: checkStreakTier(7),
  },
  streak_silver: {
    key: "streak_silver",
    tierOf: "streak",
    xpAward: 150,
    check: checkStreakTier(30),
  },
  streak_gold: {
    key: "streak_gold",
    tierOf: "streak",
    xpAward: 400,
    check: checkStreakTier(365),
  },

  // --- Exploration ---
  // "countries_bronze/_silver/_gold" from the [G3] plan is intentionally
  // NOT implemented here — see the [G3] implementation summary: no country-
  // of-origin field is captured anywhere in the catalog schema
  // (MediaItem/GameItem/BookItem), and adding one is a new persisted field
  // beyond this ticket's single approved migration (User.clickedVersionLink).
  decades_bronze: {
    key: "decades_bronze",
    tierOf: "decades",
    xpAward: 50,
    check: checkDecadesTier(5),
  },
  decades_silver: {
    key: "decades_silver",
    tierOf: "decades",
    xpAward: 150,
    check: checkDecadesTier(10),
  },
  decades_gold: {
    key: "decades_gold",
    tierOf: "decades",
    xpAward: 400,
    check: checkDecadesTier(15),
  },
  genres_bronze: {
    key: "genres_bronze",
    tierOf: "genres",
    xpAward: 50,
    check: checkGenresTier(10),
  },
  genres_silver: {
    key: "genres_silver",
    tierOf: "genres",
    xpAward: 150,
    check: checkGenresTier(20),
  },
  genres_gold: {
    key: "genres_gold",
    tierOf: "genres",
    xpAward: 400,
    check: checkGenresTier(30),
  },
  omnivore: { key: "omnivore", xpAward: 150, check: checkOmnivore },

  // --- Complétion ---
  big_screen: { key: "big_screen", xpAward: 400, check: checkBigScreen },
  well_rounded: { key: "well_rounded", xpAward: 150, check: checkWellRounded },

  // --- Saisonnier / temporel ---
  halloween: { key: "halloween", xpAward: 50, check: checkHalloween },
  contemporary: {
    key: "contemporary",
    xpAward: 150,
    check: checkContemporary,
  },
  new_year_finish: {
    key: "new_year_finish",
    xpAward: 50,
    secret: true,
    check: checkNewYearFinish,
  },

  // --- Social ---
  first_comment: {
    key: "first_comment",
    xpAward: 50,
    socialGated: true,
    check: checkFirstComment,
  },
  chatterbox_bronze: {
    key: "chatterbox_bronze",
    tierOf: "chatterbox",
    xpAward: 50,
    socialGated: true,
    check: checkChatterboxTier(20),
  },
  chatterbox_silver: {
    key: "chatterbox_silver",
    tierOf: "chatterbox",
    xpAward: 150,
    socialGated: true,
    check: checkChatterboxTier(100),
  },
  chatterbox_gold: {
    key: "chatterbox_gold",
    tierOf: "chatterbox",
    xpAward: 400,
    socialGated: true,
    check: checkChatterboxTier(500),
  },
  crowd_favorite: {
    key: "crowd_favorite",
    xpAward: 150,
    socialGated: true,
    check: checkCrowdFavorite,
  },
  standing_ovation: {
    key: "standing_ovation",
    xpAward: 150,
    socialGated: true,
    check: checkStandingOvation,
  },
  first_list: {
    key: "first_list",
    xpAward: 50,
    socialGated: true,
    check: checkFirstList,
  },
  curator_bronze: {
    key: "curator_bronze",
    tierOf: "curator",
    xpAward: 50,
    socialGated: true,
    check: checkCuratorTier(3),
  },
  curator_silver: {
    key: "curator_silver",
    tierOf: "curator",
    xpAward: 150,
    socialGated: true,
    check: checkCuratorTier(10),
  },
  curator_gold: {
    key: "curator_gold",
    tierOf: "curator",
    xpAward: 400,
    socialGated: true,
    check: checkCuratorTier(25),
  },
  followers_bronze: {
    key: "followers_bronze",
    tierOf: "followers",
    xpAward: 50,
    socialGated: true,
    check: checkFollowersTier(1),
  },
  followers_silver: {
    key: "followers_silver",
    tierOf: "followers",
    xpAward: 150,
    socialGated: true,
    check: checkFollowersTier(10),
  },
  followers_gold: {
    key: "followers_gold",
    tierOf: "followers",
    xpAward: 400,
    socialGated: true,
    check: checkFollowersTier(100),
  },
  has_friends: {
    key: "has_friends",
    xpAward: 50,
    socialGated: true,
    check: checkHasFriends,
  },
  one_sided: {
    key: "one_sided",
    xpAward: 50,
    secret: true,
    socialGated: true,
    check: checkOneSided,
  },

  // --- Compte ---
  locked_down: { key: "locked_down", xpAward: 50, check: checkLockedDown },
  member_since_bronze: {
    key: "member_since_bronze",
    tierOf: "member_since",
    xpAward: 50,
    check: checkMemberSinceTier(30),
  },
  member_since_silver: {
    key: "member_since_silver",
    tierOf: "member_since",
    xpAward: 150,
    check: checkMemberSinceTier(365),
  },
  member_since_gold: {
    key: "member_since_gold",
    tierOf: "member_since",
    xpAward: 400,
    check: checkMemberSinceTier(365 * 5),
  },
  fresh_start: { key: "fresh_start", xpAward: 50, check: checkFreshStart },
  profile_complete: {
    key: "profile_complete",
    xpAward: 50,
    check: checkProfileComplete,
  },

  // --- Autres ---
  no_favorites: {
    key: "no_favorites",
    xpAward: 150,
    secret: true,
    check: checkNoFavorites,
  },
  full_inventory: {
    key: "full_inventory",
    xpAward: 150,
    check: checkFullInventory,
  },

  // --- Secrets ---
  guilty_pleasure: {
    key: "guilty_pleasure",
    xpAward: 150,
    secret: true,
    check: checkGuiltyPleasure,
  },
  hidden_gem: {
    key: "hidden_gem",
    xpAward: 400,
    secret: true,
    check: checkHiddenGem,
  },
  full_circle: {
    key: "full_circle",
    xpAward: 150,
    secret: true,
    check: checkFullCircle,
  },
  anniversary: {
    key: "anniversary",
    xpAward: 150,
    secret: true,
    check: checkAnniversary,
  },
  welcome_back: {
    key: "welcome_back",
    xpAward: 150,
    secret: true,
    check: checkWelcomeBack,
  },
  double_life: {
    key: "double_life",
    xpAward: 150,
    secret: true,
    check: checkDoubleLife,
  },
  icebreaker: {
    key: "icebreaker",
    xpAward: 400,
    secret: true,
    check: checkIcebreaker,
  },
  first_take: {
    key: "first_take",
    xpAward: 400,
    secret: true,
    check: checkFirstTake,
  },
  curious_cat: {
    key: "curious_cat",
    xpAward: 50,
    secret: true,
    check: checkCuriousCat,
  },
};

/** `ACHIEVEMENTS` as an array, for iteration (the engine, the nightly sweep, tests). */
export const ACHIEVEMENT_LIST: AchievementDefinition[] =
  Object.values(ACHIEVEMENTS);

/**
 * Which registry keys a live XP award site should re-evaluate right after
 * crediting XP for that reason — the live-wiring half of the engine (see
 * AchievementService.evaluate's callers in LibraryService and the [G3]
 * plan's "Câblage live" section). Reasons with no achievement depending on
 * them are simply absent.
 *
 * Achievements with no natural single-moment mutation (member_since_*,
 * anniversary, welcome_back, full_circle, hidden_gem, full_inventory,
 * no_favorites, double_life) are deliberately absent here — they stay
 * nightly-sweep-only, per the [G3] plan.
 */
export const ACHIEVEMENT_KEYS_BY_XP_REASON: Partial<
  Record<XpReason, string[]>
> = {
  EPISODE_WATCHED: [
    "first_episode",
    "episode_watcher_bronze",
    "episode_watcher_silver",
    "episode_watcher_gold",
    "marathon",
    "night_owl",
    "early_bird",
    "streak_bronze",
    "streak_silver",
    "streak_gold",
    "decades_bronze",
    "decades_silver",
    "decades_gold",
    "genres_bronze",
    "genres_silver",
    "genres_gold",
    "omnivore",
    "new_year_finish",
  ],
  MOVIE_WATCHED: [
    "cinephile_bronze",
    "cinephile_silver",
    "cinephile_gold",
    "night_owl",
    "early_bird",
    "decades_bronze",
    "decades_silver",
    "decades_gold",
    "genres_bronze",
    "genres_silver",
    "genres_gold",
    "omnivore",
    "halloween",
    "contemporary",
    "new_year_finish",
  ],
  SERIES_COMPLETED: [
    "series_finisher_bronze",
    "series_finisher_silver",
    "series_finisher_gold",
    "decades_bronze",
    "decades_silver",
    "decades_gold",
    "genres_bronze",
    "genres_silver",
    "genres_gold",
    "omnivore",
    "big_screen",
    "well_rounded",
    "guilty_pleasure",
    "new_year_finish",
  ],
  GAME_FINISHED: [
    "game_finisher_bronze",
    "game_finisher_silver",
    "game_finisher_gold",
    "decades_bronze",
    "decades_silver",
    "decades_gold",
    "genres_bronze",
    "genres_silver",
    "genres_gold",
    "omnivore",
    "well_rounded",
    "new_year_finish",
  ],
  BOOK_FINISHED: [
    "book_finisher_bronze",
    "book_finisher_silver",
    "book_finisher_gold",
    "decades_bronze",
    "decades_silver",
    "decades_gold",
    "genres_bronze",
    "genres_silver",
    "genres_gold",
    "omnivore",
    "well_rounded",
    "new_year_finish",
  ],
};

// --- [G3] non-XP-reason live wiring keys, evaluated by name (not via
// ACHIEVEMENT_KEYS_BY_XP_REASON — these live sites don't credit any
// XpReason the engine dispatches on, or need to react before an XP award
// happens). See the [G3] plan's "Câblage live" section.
export const ACHIEVEMENT_KEYS_ON_FOLLOW_ACCEPTED = [
  "has_friends",
  "one_sided",
  "followers_bronze",
  "followers_silver",
  "followers_gold",
];
export const ACHIEVEMENT_KEYS_ON_TOTP_ENABLED = ["locked_down"];
export const ACHIEVEMENT_KEYS_ON_COMMENT_POSTED = [
  "first_comment",
  "chatterbox_bronze",
  "chatterbox_silver",
  "chatterbox_gold",
  "icebreaker",
];
export const ACHIEVEMENT_KEYS_ON_REVIEW_WRITTEN = ["first_take"];
export const ACHIEVEMENT_KEYS_ON_REVIEW_VOTE_UP = [
  "crowd_favorite",
  "standing_ovation",
];
export const ACHIEVEMENT_KEYS_ON_LIST_CREATED = [
  "first_list",
  "curator_bronze",
  "curator_silver",
  "curator_gold",
];
export const ACHIEVEMENT_KEYS_ON_IMPORT_COMPLETED = ["fresh_start"];
export const ACHIEVEMENT_KEYS_ON_VERSION_LINK_CLICKED = ["curious_cat"];
