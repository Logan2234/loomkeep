import { vi } from "vitest";
import type { PrismaService } from "../../prisma/prisma.service";
import {
  ACHIEVEMENT_LIST,
  ACHIEVEMENTS,
  checkAnniversary,
  checkBigScreen,
  checkChatterboxTier,
  checkCinephileTier,
  checkContemporary,
  checkCrowdFavorite,
  checkCuratorTier,
  checkCuriousCat,
  checkDecadesTier,
  checkDoubleLife,
  checkEarlyBird,
  checkEpisodeWatcherTier,
  checkFirstComment,
  checkFirstEpisode,
  checkFirstList,
  checkFirstTake,
  checkFollowersTier,
  checkFreshStart,
  checkFullCircle,
  checkFullInventory,
  checkGenresTier,
  checkGuiltyPleasure,
  checkHalloween,
  checkHasFriends,
  checkHiddenGem,
  checkIcebreaker,
  checkLockedDown,
  checkMarathon,
  checkMemberSinceTier,
  checkNewYearFinish,
  checkNightOwl,
  checkNoFavorites,
  checkOmnivore,
  checkOneSided,
  checkProfileComplete,
  checkStandingOvation,
  checkStreakTier,
  checkWelcomeBack,
  checkWellRounded,
} from "./registry";

describe("checkFirstEpisode", () => {
  it("unlocks once at least one EpisodeWatch exists", async () => {
    const prisma = {
      episodeWatch: { findFirst: vi.fn().mockResolvedValue({ id: "w1" }) },
    } as unknown as PrismaService;

    await expect(checkFirstEpisode(prisma, "user-1")).resolves.toEqual({
      unlocked: true,
    });
  });

  it("stays locked with no EpisodeWatch", async () => {
    const prisma = {
      episodeWatch: { findFirst: vi.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;

    await expect(checkFirstEpisode(prisma, "user-1")).resolves.toEqual({
      unlocked: false,
    });
  });
});

describe("checkCinephileTier", () => {
  it("unlocks once the movie count reaches the tier's target, and reports progress either way", async () => {
    const count = vi.fn().mockResolvedValue(10);
    const prisma = { libraryEntry: { count } } as unknown as PrismaService;

    await expect(checkCinephileTier(10)(prisma, "user-1")).resolves.toEqual({
      unlocked: true,
      progress: { current: 10, target: 10 },
    });
    expect(count).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        status: "COMPLETED",
        mediaItem: { type: "MOVIE" },
      },
    });

    await expect(checkCinephileTier(50)(prisma, "user-1")).resolves.toEqual({
      unlocked: false,
      progress: { current: 10, target: 50 },
    });
  });
});

// --- [G3] catalogue shape --------------------------------------------

describe("ACHIEVEMENTS catalogue shape", () => {
  it("every entry's xpAward is 50, 150 or 400", () => {
    for (const def of ACHIEVEMENT_LIST) {
      expect([50, 150, 400]).toContain(def.xpAward);
    }
  });

  it("every entry's key matches its registry object key", () => {
    for (const [registryKey, def] of Object.entries(ACHIEVEMENTS)) {
      expect(def.key).toBe(registryKey);
    }
  });

  it("every tiered family has exactly 3 keys (bronze/silver/gold)", () => {
    const byTier = new Map<string, string[]>();

    for (const def of ACHIEVEMENT_LIST) {
      if (!def.tierOf) continue;
      const arr = byTier.get(def.tierOf) ?? [];
      arr.push(def.key);
      byTier.set(def.tierOf, arr);
    }

    for (const [tierOf, keys] of byTier) {
      expect(keys.sort()).toEqual(
        [`${tierOf}_bronze`, `${tierOf}_gold`, `${tierOf}_silver`].sort(),
      );
    }
  });

  it("every family declared under 'Social' in the [G3] plan is socialGated", () => {
    const socialKeys = [
      "first_comment",
      "chatterbox_bronze",
      "chatterbox_silver",
      "chatterbox_gold",
      "crowd_favorite",
      "standing_ovation",
      "first_list",
      "curator_bronze",
      "curator_silver",
      "curator_gold",
      "followers_bronze",
      "followers_silver",
      "followers_gold",
      "has_friends",
      "one_sided",
    ];

    for (const key of socialKeys) {
      expect(ACHIEVEMENTS[key].socialGated).toBe(true);
    }
  });

  it("every entry under 'Secrets' in the [G3] plan is secret", () => {
    const secretKeys = [
      "guilty_pleasure",
      "hidden_gem",
      "full_circle",
      "anniversary",
      "welcome_back",
      "double_life",
      "icebreaker",
      "first_take",
      "curious_cat",
      "new_year_finish",
      "one_sided",
      "no_favorites",
    ];

    for (const key of secretKeys) {
      expect(ACHIEVEMENTS[key].secret).toBe(true);
    }
  });
});

// --- Volume -----------------------------------------------------------

describe("checkEpisodeWatcherTier (representative of the volume-tier family)", () => {
  it("counts every EpisodeWatch row for the user, reports progress", async () => {
    const count = vi.fn().mockResolvedValue(500);
    const prisma = { episodeWatch: { count } } as unknown as PrismaService;

    await expect(
      checkEpisodeWatcherTier(500)(prisma, "user-1"),
    ).resolves.toEqual({
      unlocked: true,
      progress: { current: 500, target: 500 },
    });
    expect(count).toHaveBeenCalledWith({ where: { userId: "user-1" } });
  });
});

// --- Rituel -------------------------------------------------------------

describe("checkMarathon", () => {
  it("unlocks once 10+ episodes share the same local calendar day", async () => {
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue({ timezone: "UTC" }) },
      episodeWatch: {
        findMany: vi.fn().mockResolvedValue(
          Array.from({ length: 10 }, (_, i) => ({
            watchedAt: new Date(
              `2026-01-01T${String(i).padStart(2, "0")}:00:00Z`,
            ),
          })),
        ),
      },
    } as unknown as PrismaService;

    await expect(checkMarathon(prisma, "user-1")).resolves.toEqual({
      unlocked: true,
    });
  });

  it("stays locked when 10 episodes are spread across different days", async () => {
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue({ timezone: "UTC" }) },
      episodeWatch: {
        findMany: vi.fn().mockResolvedValue(
          Array.from({ length: 10 }, (_, i) => ({
            watchedAt: new Date(
              `2026-01-${String(i + 1).padStart(2, "0")}T00:00:00Z`,
            ),
          })),
        ),
      },
    } as unknown as PrismaService;

    await expect(checkMarathon(prisma, "user-1")).resolves.toEqual({
      unlocked: false,
    });
  });
});

describe("checkNightOwl / checkEarlyBird (hour-window family)", () => {
  it("unlocks off an episode watched inside the 2h-4h window, local time", async () => {
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue({ timezone: "UTC" }) },
      episodeWatch: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ watchedAt: new Date("2026-01-01T03:00:00Z") }]),
      },
      libraryEntry: { findMany: vi.fn().mockResolvedValue([]) },
      movieReplay: { findMany: vi.fn().mockResolvedValue([]) },
    } as unknown as PrismaService;

    await expect(checkNightOwl(prisma, "user-1")).resolves.toEqual({
      unlocked: true,
    });
  });

  it("stays locked outside the window", async () => {
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue({ timezone: "UTC" }) },
      episodeWatch: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ watchedAt: new Date("2026-01-01T12:00:00Z") }]),
      },
      libraryEntry: { findMany: vi.fn().mockResolvedValue([]) },
      movieReplay: { findMany: vi.fn().mockResolvedValue([]) },
    } as unknown as PrismaService;

    await expect(checkEarlyBird(prisma, "user-1")).resolves.toEqual({
      unlocked: false,
    });
  });
});

describe("checkStreakTier", () => {
  it("computes the current episode-watch streak and reports it as progress", async () => {
    const now = new Date("2026-01-03T12:00:00Z");
    const prisma = {
      episodeWatch: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            { watchedAt: new Date("2026-01-01T00:00:00Z") },
            { watchedAt: new Date("2026-01-02T00:00:00Z") },
            { watchedAt: new Date("2026-01-03T00:00:00Z") },
          ]),
      },
    } as unknown as PrismaService;

    vi.setSystemTime(now);
    await expect(checkStreakTier(3)(prisma, "user-1")).resolves.toEqual({
      unlocked: true,
      progress: { current: 3, target: 3 },
    });
    vi.useRealTimers();
  });
});

// --- Exploration ----------------------------------------------------------

describe("checkDecadesTier / checkGenresTier (exploration family)", () => {
  it("counts distinct decades across media/games/books", async () => {
    const prisma = {
      libraryEntry: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            { mediaItem: { releaseDate: new Date("1995-01-01") } },
          ]),
      },
      gameEntry: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            { gameItem: { releaseDate: new Date("2005-01-01") } },
          ]),
      },
      bookEntry: {
        findMany: vi.fn().mockResolvedValue([
          { bookItem: { releaseDate: new Date("1995-06-01") } }, // same decade as the movie above
        ]),
      },
    } as unknown as PrismaService;

    await expect(checkDecadesTier(2)(prisma, "user-1")).resolves.toEqual({
      unlocked: true,
      progress: { current: 2, target: 2 },
    });
  });

  it("counts distinct genres across media/games/books", async () => {
    const prisma = {
      libraryEntry: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ mediaItem: { genres: ["Horror", "Drama"] } }]),
      },
      gameEntry: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ gameItem: { genres: ["RPG"] } }]),
      },
      bookEntry: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ bookItem: { genres: ["Drama"] } }]), // dupe, doesn't inflate the count
      },
    } as unknown as PrismaService;

    await expect(checkGenresTier(3)(prisma, "user-1")).resolves.toEqual({
      unlocked: true,
      progress: { current: 3, target: 3 },
    });
  });
});

describe("checkOmnivore", () => {
  it("unlocks once every active domain has at least one tracked entry", async () => {
    const prisma = {
      libraryEntry: { count: vi.fn().mockResolvedValue(1) },
      gameEntry: { count: vi.fn().mockResolvedValue(1) },
      bookEntry: { count: vi.fn().mockResolvedValue(1) },
    } as unknown as PrismaService;

    await expect(checkOmnivore(prisma, "user-1")).resolves.toEqual({
      unlocked: true,
      progress: { current: 3, target: 3 },
    });
  });
});

// --- Complétion -----------------------------------------------------------

describe("checkBigScreen", () => {
  it("counts completed series/anime with 5+ real seasons", async () => {
    const bigSeries = { mediaItem: { seasons: Array(5).fill({ id: "s" }) } };
    const smallSeries = { mediaItem: { seasons: Array(2).fill({ id: "s" }) } };
    const prisma = {
      libraryEntry: {
        findMany: vi
          .fn()
          .mockResolvedValue(Array(5).fill(bigSeries).concat(smallSeries)),
      },
    } as unknown as PrismaService;

    await expect(checkBigScreen(prisma, "user-1")).resolves.toEqual({
      unlocked: true,
      progress: { current: 5, target: 5 },
    });
  });
});

describe("checkWellRounded", () => {
  it("counts how many active domains reach 10+ finished titles", async () => {
    const prisma = {
      libraryEntry: { count: vi.fn().mockResolvedValue(10) },
      gameEntry: { count: vi.fn().mockResolvedValue(10) },
      bookEntry: { count: vi.fn().mockResolvedValue(10) },
    } as unknown as PrismaService;

    await expect(checkWellRounded(prisma, "user-1")).resolves.toEqual({
      unlocked: true,
      progress: { current: 3, target: 3 },
    });
  });
});

// --- Saisonnier -------------------------------------------------------

describe("checkHalloween", () => {
  it("unlocks off a horror episode/movie watched in October", async () => {
    const prisma = {
      episodeWatch: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ watchedAt: new Date("2026-10-15T00:00:00Z") }]),
      },
      libraryEntry: { findMany: vi.fn().mockResolvedValue([]) },
      movieReplay: { findMany: vi.fn().mockResolvedValue([]) },
    } as unknown as PrismaService;

    await expect(checkHalloween(prisma, "user-1")).resolves.toEqual({
      unlocked: true,
    });
  });
});

describe("checkContemporary", () => {
  it("unlocks off a completed movie released the user's own birth year", async () => {
    const prisma = {
      user: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ birthDate: new Date("1995-05-01") }),
      },
      libraryEntry: { findFirst: vi.fn().mockResolvedValue({ id: "e1" }) },
    } as unknown as PrismaService;

    await expect(checkContemporary(prisma, "user-1")).resolves.toEqual({
      unlocked: true,
    });
  });

  it("stays locked when the user has no birth date on file", async () => {
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue({ birthDate: null }) },
    } as unknown as PrismaService;

    await expect(checkContemporary(prisma, "user-1")).resolves.toEqual({
      unlocked: false,
    });
  });
});

describe("checkNewYearFinish", () => {
  it("unlocks off a work finished on January 1st, local time", async () => {
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue({ timezone: "UTC" }) },
      libraryEntry: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            { finishedAt: new Date("2026-01-01T10:00:00Z") },
          ]),
      },
      gameEntry: { findMany: vi.fn().mockResolvedValue([]) },
      bookEntry: { findMany: vi.fn().mockResolvedValue([]) },
    } as unknown as PrismaService;

    await expect(checkNewYearFinish(prisma, "user-1")).resolves.toEqual({
      unlocked: true,
    });
  });
});

// --- Social -------------------------------------------------------------

describe("checkFirstComment / checkChatterboxTier", () => {
  it("checkFirstComment unlocks off any non-deleted comment", async () => {
    const prisma = {
      comment: { findFirst: vi.fn().mockResolvedValue({ id: "c1" }) },
    } as unknown as PrismaService;
    await expect(checkFirstComment(prisma, "user-1")).resolves.toEqual({
      unlocked: true,
    });
  });

  it("checkChatterboxTier counts non-deleted comments", async () => {
    const count = vi.fn().mockResolvedValue(20);
    const prisma = { comment: { count } } as unknown as PrismaService;
    await expect(checkChatterboxTier(20)(prisma, "user-1")).resolves.toEqual({
      unlocked: true,
      progress: { current: 20, target: 20 },
    });
    expect(count).toHaveBeenCalledWith({
      where: { authorId: "user-1", deletedAt: null },
    });
  });
});

describe("checkCrowdFavorite / checkStandingOvation", () => {
  it("checkCrowdFavorite sums UP votes across all of the user's reviews", async () => {
    const prisma = {
      reviewVote: { count: vi.fn().mockResolvedValue(25) },
    } as unknown as PrismaService;
    await expect(checkCrowdFavorite(prisma, "user-1")).resolves.toEqual({
      unlocked: true,
      progress: { current: 25, target: 20 },
    });
  });

  it("checkStandingOvation looks at the single best-voted review", async () => {
    const prisma = {
      reviewVote: {
        groupBy: vi.fn().mockResolvedValue([
          { reviewId: "r1", _count: { _all: 25 } },
          { reviewId: "r2", _count: { _all: 5 } },
        ]),
      },
    } as unknown as PrismaService;
    await expect(checkStandingOvation(prisma, "user-1")).resolves.toEqual({
      unlocked: true,
      progress: { current: 25, target: 20 },
    });
  });
});

describe("checkFirstList / checkCuratorTier", () => {
  it("checkFirstList requires a non-PRIVATE list", async () => {
    const prisma = {
      list: { findFirst: vi.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;
    await expect(checkFirstList(prisma, "user-1")).resolves.toEqual({
      unlocked: false,
    });
  });

  it("checkCuratorTier counts every list regardless of visibility", async () => {
    const count = vi.fn().mockResolvedValue(3);
    const prisma = { list: { count } } as unknown as PrismaService;
    await expect(checkCuratorTier(3)(prisma, "user-1")).resolves.toEqual({
      unlocked: true,
      progress: { current: 3, target: 3 },
    });
  });
});

describe("checkFollowersTier / checkHasFriends / checkOneSided", () => {
  it("checkFollowersTier counts accepted followers", async () => {
    const count = vi.fn().mockResolvedValue(1);
    const prisma = { follow: { count } } as unknown as PrismaService;
    await expect(checkFollowersTier(1)(prisma, "user-1")).resolves.toEqual({
      unlocked: true,
      progress: { current: 1, target: 1 },
    });
    expect(count).toHaveBeenCalledWith({
      where: { followeeId: "user-1", status: "ACCEPTED" },
    });
  });

  it("checkHasFriends requires a mutual accepted follow", async () => {
    const prisma = {
      follow: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([{ followeeId: "b" }]) // following
          .mockResolvedValueOnce([{ followerId: "b" }]), // followers
      },
    } as unknown as PrismaService;
    await expect(checkHasFriends(prisma, "user-1")).resolves.toEqual({
      unlocked: true,
    });
  });

  it("checkOneSided requires a followee who doesn't follow back", async () => {
    const prisma = {
      follow: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([{ followeeId: "b" }]) // following
          .mockResolvedValueOnce([]), // followers
      },
    } as unknown as PrismaService;
    await expect(checkOneSided(prisma, "user-1")).resolves.toEqual({
      unlocked: true,
    });
  });
});

// --- Compte ---------------------------------------------------------------

describe("checkLockedDown", () => {
  it("reflects User.mfaTotpEnabled", async () => {
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue({ mfaTotpEnabled: true }) },
    } as unknown as PrismaService;
    await expect(checkLockedDown(prisma, "user-1")).resolves.toEqual({
      unlocked: true,
    });
  });
});

describe("checkMemberSinceTier", () => {
  it("unlocks once the account is old enough, reports elapsed days as progress", async () => {
    const now = new Date("2026-02-01T00:00:00Z");
    const prisma = {
      user: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ createdAt: new Date("2026-01-01T00:00:00Z") }),
      },
    } as unknown as PrismaService;

    vi.setSystemTime(now);
    await expect(checkMemberSinceTier(30)(prisma, "user-1")).resolves.toEqual({
      unlocked: true,
      progress: { current: 30, target: 30 },
    });
    vi.useRealTimers();
  });
});

describe("checkFreshStart", () => {
  it("unlocks off a successful ImportRun", async () => {
    const prisma = {
      importRun: { findFirst: vi.fn().mockResolvedValue({ id: "run-1" }) },
    } as unknown as PrismaService;
    await expect(checkFreshStart(prisma, "user-1")).resolves.toEqual({
      unlocked: true,
    });
  });
});

describe("checkProfileComplete", () => {
  it("requires both an avatar and a non-empty bio", async () => {
    const prisma = {
      user: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ avatar: Buffer.from("x"), bio: "Hello" }),
      },
    } as unknown as PrismaService;
    await expect(checkProfileComplete(prisma, "user-1")).resolves.toEqual({
      unlocked: true,
    });
  });

  it("stays locked with a blank bio", async () => {
    const prisma = {
      user: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ avatar: Buffer.from("x"), bio: "   " }),
      },
    } as unknown as PrismaService;
    await expect(checkProfileComplete(prisma, "user-1")).resolves.toEqual({
      unlocked: false,
    });
  });
});

// --- Autres -----------------------------------------------------------

describe("checkNoFavorites", () => {
  it("unlocks only past 100 tracked titles with zero favorites", async () => {
    const prisma = {
      libraryEntry: {
        count: vi.fn((args?: { where?: { favorite?: boolean } }) =>
          Promise.resolve(args?.where?.favorite ? 0 : 100),
        ),
      },
      gameEntry: { count: vi.fn().mockResolvedValue(0) },
      bookEntry: { count: vi.fn().mockResolvedValue(0) },
      musicEntry: { count: vi.fn().mockResolvedValue(0) },
    } as unknown as PrismaService;

    await expect(checkNoFavorites(prisma, "user-1")).resolves.toEqual({
      unlocked: true,
    });
  });
});

describe("checkFullInventory", () => {
  it("requires every MediaOwnershipStatus value used at least once", async () => {
    const prisma = {
      libraryEntry: {
        findMany: vi
          .fn()
          .mockResolvedValue(
            ["PHYSICAL", "DIGITAL", "STREAMING", "BORROWED"].map(
              (ownershipStatus) => ({ ownershipStatus }),
            ),
          ),
      },
    } as unknown as PrismaService;

    await expect(checkFullInventory(prisma, "user-1")).resolves.toEqual({
      unlocked: true,
      progress: { current: 4, target: 4 },
    });
  });
});

// --- Secrets ------------------------------------------------------------

describe("checkGuiltyPleasure", () => {
  it("unlocks off a completed series rated 1-3 by the user", async () => {
    const prisma = {
      libraryEntry: {
        findMany: vi.fn().mockResolvedValue([{ mediaItemId: "m1" }]),
      },
      review: { findFirst: vi.fn().mockResolvedValue({ id: "r1" }) },
    } as unknown as PrismaService;

    await expect(checkGuiltyPleasure(prisma, "user-1")).resolves.toEqual({
      unlocked: true,
    });
  });
});

describe("checkHiddenGem", () => {
  it("unlocks off a title tracked by nobody else", async () => {
    const prisma = {
      libraryEntry: {
        findMany: vi.fn().mockResolvedValue([{ mediaItemId: "m1" }]),
        count: vi.fn().mockResolvedValue(1),
      },
      gameEntry: { findMany: vi.fn().mockResolvedValue([]) },
      bookEntry: { findMany: vi.fn().mockResolvedValue([]) },
    } as unknown as PrismaService;

    await expect(checkHiddenGem(prisma, "user-1")).resolves.toEqual({
      unlocked: true,
    });
  });
});

describe("checkFullCircle", () => {
  it("unlocks off a replay of the very first tracked title", async () => {
    const prisma = {
      libraryEntry: {
        findFirst: vi
          .fn()
          .mockResolvedValue({ id: "e1", createdAt: new Date("2026-01-01") }),
      },
      gameEntry: { findFirst: vi.fn().mockResolvedValue(null) },
      bookEntry: { findFirst: vi.fn().mockResolvedValue(null) },
      movieReplay: { findFirst: vi.fn().mockResolvedValue({ id: "replay-1" }) },
    } as unknown as PrismaService;

    await expect(checkFullCircle(prisma, "user-1")).resolves.toEqual({
      unlocked: true,
    });
  });
});

describe("checkAnniversary", () => {
  it("unlocks off activity on the same month/day as account creation, a later year", async () => {
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          createdAt: new Date("2025-06-15T00:00:00Z"),
          timezone: "UTC",
        }),
      },
      episodeWatch: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ watchedAt: new Date("2026-06-15T10:00:00Z") }]),
      },
      comment: { findMany: vi.fn().mockResolvedValue([]) },
      review: { findMany: vi.fn().mockResolvedValue([]) },
    } as unknown as PrismaService;

    await expect(checkAnniversary(prisma, "user-1")).resolves.toEqual({
      unlocked: true,
    });
  });
});

describe("checkWelcomeBack", () => {
  it("unlocks off a 182+ day gap between two episode watches", async () => {
    const prisma = {
      episodeWatch: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            { watchedAt: new Date("2025-01-01T00:00:00Z") },
            { watchedAt: new Date("2025-08-01T00:00:00Z") },
          ]),
      },
    } as unknown as PrismaService;

    await expect(checkWelcomeBack(prisma, "user-1")).resolves.toEqual({
      unlocked: true,
    });
  });
});

describe("checkDoubleLife", () => {
  it("requires GHOST + at least one review or comment", async () => {
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({ profileAccess: "GHOST" }),
      },
      review: { findFirst: vi.fn().mockResolvedValue({ id: "r1" }) },
      comment: { findFirst: vi.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;

    await expect(checkDoubleLife(prisma, "user-1")).resolves.toEqual({
      unlocked: true,
    });
  });

  it("stays locked for a non-GHOST profile even with reviews", async () => {
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({ profileAccess: "PUBLIC" }),
      },
    } as unknown as PrismaService;

    await expect(checkDoubleLife(prisma, "user-1")).resolves.toEqual({
      unlocked: false,
    });
  });
});

describe("checkIcebreaker / checkFirstTake (per-target 'first' family)", () => {
  it("checkIcebreaker unlocks when the user's comment is the earliest on some target", async () => {
    const prisma = {
      comment: {
        findMany: vi.fn().mockResolvedValue([{ targetId: "m1" }]),
        findFirst: vi.fn().mockResolvedValue({ authorId: "user-1" }),
      },
    } as unknown as PrismaService;

    await expect(checkIcebreaker(prisma, "user-1")).resolves.toEqual({
      unlocked: true,
    });
  });

  it("checkIcebreaker stays locked when someone else commented first on every target", async () => {
    const prisma = {
      comment: {
        findMany: vi.fn().mockResolvedValue([{ targetId: "m1" }]),
        findFirst: vi.fn().mockResolvedValue({ authorId: "someone-else" }),
      },
    } as unknown as PrismaService;

    await expect(checkIcebreaker(prisma, "user-1")).resolves.toEqual({
      unlocked: false,
    });
  });

  it("checkFirstTake unlocks when the user's review is the earliest on some target", async () => {
    const prisma = {
      review: {
        findMany: vi.fn().mockResolvedValue([{ targetId: "m1" }]),
        findFirst: vi.fn().mockResolvedValue({ userId: "user-1" }),
      },
    } as unknown as PrismaService;

    await expect(checkFirstTake(prisma, "user-1")).resolves.toEqual({
      unlocked: true,
    });
  });
});

describe("checkCuriousCat", () => {
  // Event-granted, not state-derived: the nightly sweep must never unlock it
  // on its own — only markVersionLinkClicked does.
  it("never unlocks on its own", async () => {
    await expect(checkCuriousCat()).resolves.toEqual({ unlocked: false });
  });
});

describe("registry metadata", () => {
  it("gives every entry a family, secrets included", () => {
    const familyless = ACHIEVEMENT_LIST.filter((d) => !d.family).map(
      (d) => d.key,
    );

    expect(familyless).toEqual([]);
  });

  it("declares a tier on exactly the tiered entries", () => {
    const mismatched = ACHIEVEMENT_LIST.filter(
      (d) => Boolean(d.tierOf) !== Boolean(d.tier),
    ).map((d) => d.key);

    expect(mismatched).toEqual([]);
  });

  // The tier is an explicit field precisely so nothing has to parse the key,
  // but the two must still agree — a mismatch would mean a copy/paste slip
  // in the registry.
  it("keeps the declared tier consistent with the key suffix", () => {
    const mismatched = ACHIEVEMENT_LIST.filter(
      (d) => d.tier && !d.key.endsWith(`_${d.tier}`),
    ).map((d) => d.key);

    expect(mismatched).toEqual([]);
  });

  it("keys every entry of ACHIEVEMENTS by its own key", () => {
    const mismatched = Object.entries(ACHIEVEMENTS)
      .filter(([key, definition]) => key !== definition.key)
      .map(([key]) => key);

    expect(mismatched).toEqual([]);
  });
});
