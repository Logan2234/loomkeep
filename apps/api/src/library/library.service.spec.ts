import { vi } from "vitest";
import type { MediaItemService } from "../catalog/media-item.service";
import type { EntitlementService } from "../entitlements/entitlement.service";
import type { AchievementService } from "../gamification/achievements/achievement.service";
import { ACHIEVEMENT_KEYS_BY_XP_REASON } from "../gamification/achievements/registry";
import type { XpService } from "../gamification/xp.service";
import type { PrismaService } from "../prisma/prisma.service";
import type { ReviewService } from "../reviews/review.service";
import type { ActivityService } from "../social/activity.service";
import type { AgeGateService } from "../users/age-gate.service";
import { LibraryService } from "./library.service";

// Stubbed no-op — the [G1] wiring itself is covered by xp.service.spec.ts,
// these tests only need LibraryService to not blow up calling it.
function stubXp(): XpService {
  return {
    award: vi.fn(),
    awardMany: vi.fn(),
    revokeBySource: vi.fn(),
  } as unknown as XpService;
}

// Stubbed no-op — the [G2] wiring itself is covered by achievement.service.spec.ts,
// these tests only need LibraryService to not blow up calling it.
function stubAchievements(): AchievementService {
  return {
    evaluate: vi.fn(),
  } as unknown as AchievementService;
}

function makeRow(overrides: Partial<Record<string, unknown>> = {}) {
  const id = (overrides.id as string) ?? "entry-1";
  return {
    id,
    userId: "user-1",
    mediaItemId: `media-${id}`,
    status: overrides.status ?? "PLANNED",
    rating: overrides.rating ?? null,
    notes: null,
    favorite: overrides.favorite ?? false,
    startedAt: null,
    finishedAt: overrides.finishedAt ?? null,
    ownershipStatus: "NONE",
    ownershipSource: null,
    createdAt: overrides.createdAt ?? new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: overrides.updatedAt ?? new Date("2026-01-01T00:00:00.000Z"),
    mediaItem: {
      id: `media-${id}`,
      type: overrides.type ?? "MOVIE",
      title: overrides.title ?? "Arrival",
      posterUrl: null,
      canonicalSource: "TMDB",
      status: overrides.airingStatus ?? "Ended",
      externalIds: [{ source: "TMDB", externalId: `tmdb-${id}` }],
    },
    replays: overrides.replays ?? [],
  };
}

interface ServiceOpts {
  episodesByMediaItem?: Record<
    string,
    {
      id: string;
      number: number;
      airDate: Date | null;
      season: { number: number };
    }[]
  >;
  watchedByMediaItem?: Record<string, string[]>;
  lastWatchedByMediaItem?: Record<string, Date | null>;
  translatedTitles?: Map<string, string>;
}

function makeService(
  rows: ReturnType<typeof makeRow>[],
  opts: ServiceOpts = {},
) {
  const prisma = {
    libraryEntry: { findMany: vi.fn().mockResolvedValue(rows) },
    // listEntries fetches episodes/watches batched across all media items
    // (`mediaItemId: { in: [...] }`) rather than one query per entry.
    episode: {
      findMany: vi.fn(
        ({ where }: { where: { season: { mediaItemId: { in: string[] } } } }) =>
          Promise.resolve(
            where.season.mediaItemId.in.flatMap((mediaItemId) =>
              (opts.episodesByMediaItem?.[mediaItemId] ?? []).map((e) => ({
                ...e,
                season: { ...e.season, mediaItemId },
              })),
            ),
          ),
      ),
    },
    episodeWatch: {
      findMany: vi.fn(
        ({
          where,
        }: {
          where: { episode: { season: { mediaItemId: { in: string[] } } } };
        }) =>
          Promise.resolve(
            where.episode.season.mediaItemId.in.flatMap((mediaItemId) => {
              const watchedAt =
                opts.lastWatchedByMediaItem?.[mediaItemId] ?? new Date(0);
              return (opts.watchedByMediaItem?.[mediaItemId] ?? []).map(
                (episodeId) => ({
                  episodeId,
                  watchedAt,
                  episode: { season: { mediaItemId, number: 1 } },
                }),
              );
            }),
          ),
      ),
    },
  } as unknown as PrismaService;
  // Ratings now come from Review; project the rows' ratings back through it.
  const reviews = {
    getRatings: vi.fn(() =>
      Promise.resolve(
        new Map(
          rows
            .filter((r) => r.rating !== null)
            .map((r) => [r.mediaItemId, r.rating]),
        ),
      ),
    ),
    getRating: vi.fn((_u: string, _t: string, id: string) =>
      Promise.resolve(rows.find((r) => r.mediaItemId === id)?.rating ?? null),
    ),
    setRating: vi.fn(),
  } as unknown as ReviewService;
  const mediaItemService = {
    translatedTitles: vi
      .fn()
      .mockResolvedValue(opts.translatedTitles ?? new Map()),
  } as unknown as MediaItemService;
  const service = new LibraryService(
    prisma,
    mediaItemService,
    {} as AgeGateService,
    reviews,
    { emit: vi.fn() } as unknown as ActivityService,
    {} as EntitlementService,
    stubXp(),
    stubAchievements(),
  );
  return { service, prisma, mediaItemService };
}

describe("LibraryService.listEntries", () => {
  it("paginates and reports total/hasMore (movies, no episode progress)", async () => {
    const rows = Array.from({ length: 45 }, (_, i) =>
      makeRow({ id: `e${i}`, title: `Movie ${i}` }),
    );
    const { service } = makeService(rows);

    const page1 = await service.listEntries("user-1", {});
    expect(page1.items).toHaveLength(40);
    expect(page1.total).toBe(45);
    expect(page1.hasMore).toBe(true);

    const page2 = await service.listEntries("user-1", { page: 2 });
    expect(page2.items).toHaveLength(5);
    expect(page2.hasMore).toBe(false);
  });

  it("filters by favorite", async () => {
    const rows = [
      makeRow({ id: "a", favorite: true }),
      makeRow({ id: "b", favorite: false }),
    ];
    const { service } = makeService(rows);

    const result = await service.listEntries("user-1", { favorite: true });
    expect(result.items.map((i) => i.id)).toEqual(["a"]);
  });

  it("filters by free-text title search, case-insensitive", async () => {
    const rows = [
      makeRow({ id: "a", title: "Arrival" }),
      makeRow({ id: "b", title: "Dune" }),
    ];
    const { service } = makeService(rows);

    const result = await service.listEntries("user-1", { q: "arr" });
    expect(result.items.map((i) => i.id)).toEqual(["a"]);
  });

  it("includes the entry update timestamp", async () => {
    const updatedAt = new Date("2026-02-03T04:05:06.000Z");
    const { service } = makeService([makeRow({ updatedAt })]);

    const result = await service.listEntries("user-1", {});

    expect(result.items[0].updatedAt).toBe(updatedAt.toISOString());
  });

  it("filters the synthetic DORMANT status (WATCHING with no recent activity)", async () => {
    const dormantRow = makeRow({
      id: "dormant",
      type: "SERIES",
      status: "WATCHING",
    });
    const activeRow = makeRow({
      id: "active",
      type: "SERIES",
      status: "WATCHING",
    });
    const episodes = [
      { id: "ep1", number: 1, airDate: null, season: { number: 1 } },
      { id: "ep2", number: 2, airDate: null, season: { number: 1 } },
    ];
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    const oneDayAgo = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
    const { service } = makeService([dormantRow, activeRow], {
      episodesByMediaItem: {
        "media-dormant": episodes,
        "media-active": episodes,
      },
      watchedByMediaItem: {
        "media-dormant": ["ep1"],
        "media-active": ["ep1"],
      },
      lastWatchedByMediaItem: {
        "media-dormant": sixtyDaysAgo,
        "media-active": oneDayAgo,
      },
    });

    const dormantOnly = await service.listEntries("user-1", {
      statuses: ["DORMANT"],
    });
    expect(dormantOnly.items.map((i) => i.id)).toEqual(["dormant"]);

    const bothWatching = await service.listEntries("user-1", {
      statuses: ["WATCHING"],
    });
    expect(bothWatching.items.map((i) => i.id).sort()).toEqual([
      "active",
      "dormant",
    ]);
  });

  it("uses the translated title when one is cached, falling back to the base title otherwise", async () => {
    const rows = [
      makeRow({ id: "a", title: "Arrival" }),
      makeRow({ id: "b", title: "Dune" }),
    ];
    const { service, mediaItemService } = makeService(rows, {
      translatedTitles: new Map([["media-a", "Premier Contact"]]),
    });

    const result = await service.listEntries("user-1", { lang: "fr" });

    expect(mediaItemService.translatedTitles).toHaveBeenCalledWith(
      ["media-a", "media-b"],
      "fr",
    );
    expect(result.items.find((i) => i.id === "a")?.mediaItem.title).toBe(
      "Premier Contact",
    );
    expect(result.items.find((i) => i.id === "b")?.mediaItem.title).toBe(
      "Dune",
    );
  });

  it("doesn't look up translations when no locale is given", async () => {
    const { service, mediaItemService } = makeService([makeRow({ id: "a" })]);

    await service.listEntries("user-1", {});

    expect(mediaItemService.translatedTitles).not.toHaveBeenCalled();
  });
});

// Regression: entry.finishedAt used to only ever be set by an explicit dto
// field nothing in the UI ever sends, so CommentService.isMasked's
// work-level spoiler gate (`!entry?.finishedAt`) stayed permanently true —
// a movie/series' comment thread stayed blurred forever, even to viewers
// who had actually finished it.
describe("LibraryService — finishedAt sync (comment-masking gate)", () => {
  it("sets finishedAt when a movie's status is patched to COMPLETED", async () => {
    const entryRow = makeRow({ id: "e1", type: "MOVIE", status: "PLANNED" });

    const findUnique = vi
      .fn()
      // assertEntryOwnership
      .mockResolvedValueOnce({ id: "e1", userId: "user-1" })
      // updateEntry's own "before" lookup
      .mockResolvedValueOnce({ status: "PLANNED", favorite: false })
      // syncFinishedAt's lookup, post-write
      .mockResolvedValueOnce({ status: "COMPLETED", finishedAt: null });
    const update = vi
      .fn()
      // the main entry write
      .mockResolvedValueOnce({ ...entryRow, status: "COMPLETED" })
      // syncFinishedAt's finishedAt-only write
      .mockResolvedValueOnce({});

    const prisma = {
      libraryEntry: { findUnique, update },
      episode: { findMany: vi.fn().mockResolvedValue([]) },
      episodeWatch: {
        aggregate: vi.fn().mockResolvedValue({ _max: { watchedAt: null } }),
      },
    } as unknown as PrismaService;
    const reviews = {
      getRating: vi.fn().mockResolvedValue(null),
      setRating: vi.fn(),
    } as unknown as ReviewService;
    const activity = { emit: vi.fn() } as unknown as ActivityService;
    const service = new LibraryService(
      prisma,
      {} as MediaItemService,
      {} as AgeGateService,
      reviews,
      activity,
      {} as EntitlementService,
      stubXp(),
      stubAchievements(),
    );

    const result = await service.updateEntry("user-1", "e1", {
      status: "COMPLETED",
    });

    expect(result.finishedAt).not.toBeNull();
    expect(update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ data: { finishedAt: expect.any(Date) } }),
    );
  });

  it("does not override finishedAt when the caller sets it explicitly", async () => {
    const entryRow = makeRow({ id: "e1", type: "MOVIE", status: "PLANNED" });
    const explicit = "2026-01-15T00:00:00.000Z";

    const findUnique = vi
      .fn()
      .mockResolvedValueOnce({ id: "e1", userId: "user-1" })
      .mockResolvedValueOnce({ status: "PLANNED", favorite: false });
    const update = vi.fn().mockResolvedValueOnce({
      ...entryRow,
      status: "COMPLETED",
      finishedAt: new Date(explicit),
    });

    const prisma = {
      libraryEntry: { findUnique, update },
      episode: { findMany: vi.fn().mockResolvedValue([]) },
      episodeWatch: {
        aggregate: vi.fn().mockResolvedValue({ _max: { watchedAt: null } }),
      },
    } as unknown as PrismaService;
    const reviews = {
      getRating: vi.fn().mockResolvedValue(null),
      setRating: vi.fn(),
    } as unknown as ReviewService;
    const activity = { emit: vi.fn() } as unknown as ActivityService;
    const service = new LibraryService(
      prisma,
      {} as MediaItemService,
      {} as AgeGateService,
      reviews,
      activity,
      {} as EntitlementService,
      stubXp(),
      stubAchievements(),
    );

    const result = await service.updateEntry("user-1", "e1", {
      status: "COMPLETED",
      finishedAt: explicit,
    });

    expect(result.finishedAt).toBe(explicit);
    // Only the main write happens — no extra syncFinishedAt write.
    expect(update).toHaveBeenCalledTimes(1);
  });

  it("sets finishedAt once the last episode of a series is watched", async () => {
    const episode = {
      id: "ep2",
      airDate: null as Date | null,
      season: { mediaItemId: "media-1", mediaItem: { type: "SERIES" } },
    };

    const prisma = {
      episode: {
        findUnique: vi.fn().mockResolvedValue(episode),
        findMany: vi.fn().mockResolvedValue([
          { id: "ep1", number: 1, airDate: null, season: { number: 1 } },
          { id: "ep2", number: 2, airDate: null, season: { number: 1 } },
        ]),
      },
      episodeWatch: {
        create: vi.fn().mockResolvedValue({
          id: "w1",
          episodeId: "ep2",
          watchedAt: new Date(),
        }),
        findMany: vi
          .fn()
          .mockResolvedValue([{ episodeId: "ep1" }, { episodeId: "ep2" }]),
      },
      // syncSeasonAndSeriesXp's own lookup — no seasons found is enough to
      // short-circuit it for this test, which isn't exercising completion.
      season: { findMany: vi.fn().mockResolvedValue([]) },
      libraryEntry: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ status: "WATCHING", finishedAt: null }),
        findMany: vi.fn().mockResolvedValue([]),
        update: vi.fn().mockResolvedValue({}),
      },
    } as unknown as PrismaService;
    const activity = { emit: vi.fn() } as unknown as ActivityService;
    const service = new LibraryService(
      prisma,
      {} as MediaItemService,
      {} as AgeGateService,
      {} as ReviewService,
      activity,
      {} as EntitlementService,
      stubXp(),
      stubAchievements(),
    );

    await service.watchEpisode("user-1", "ep2", {});

    expect(prisma.libraryEntry.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { finishedAt: expect.any(Date) } }),
    );
    expect(activity.emit).toHaveBeenCalledWith(
      expect.objectContaining({ type: "PROGRESS", targetId: "media-1" }),
    );
  });
});

describe("LibraryService.unwatchSeason", () => {
  it("clears every watch for the season's episodes and re-syncs finishedAt", async () => {
    const seasonEpisodes = [{ id: "ep1" }, { id: "ep2" }];
    const progressEpisodes = [
      { id: "ep1", number: 1, airDate: null, season: { number: 1 } },
      { id: "ep2", number: 2, airDate: null, season: { number: 1 } },
    ];

    const deleteMany = vi.fn().mockResolvedValue({ count: 2 });
    const prisma = {
      season: {
        findUnique: vi.fn().mockResolvedValue({
          mediaItemId: "media-1",
          mediaItem: { type: "SERIES" },
        }),
        // syncSeasonAndSeriesXp's own lookup — no seasons found is enough to
        // short-circuit it for this test, which isn't exercising completion.
        findMany: vi.fn().mockResolvedValue([]),
      },
      episode: {
        findMany: vi
          .fn()
          // unwatchSeason's own lookup (season's episode ids)
          .mockImplementationOnce(() => Promise.resolve(seasonEpisodes))
          // computeProgress, via syncFinishedAt
          .mockImplementationOnce(() => Promise.resolve(progressEpisodes)),
      },
      episodeWatch: {
        deleteMany,
        findMany: vi.fn().mockResolvedValue([]), // nothing left watched
      },
      libraryEntry: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ status: "COMPLETED", finishedAt: new Date() }),
        findMany: vi.fn().mockResolvedValue([]),
        update: vi.fn().mockResolvedValue({}),
      },
    } as unknown as PrismaService;

    const activity = { emit: vi.fn() } as unknown as ActivityService;
    const service = new LibraryService(
      prisma,
      {} as MediaItemService,
      {} as AgeGateService,
      {} as ReviewService,
      activity,
      {} as EntitlementService,
      stubXp(),
      stubAchievements(),
    );

    await service.unwatchSeason("user-1", "season-1");

    expect(deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1", episodeId: { in: ["ep1", "ep2"] } },
    });
    // The entry was COMPLETED with finishedAt set, but progress is now 0/2
    // watched, so syncFinishedAt should clear it back to null.
    expect(prisma.libraryEntry.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { finishedAt: null } }),
    );
  });

  it("throws when the season doesn't exist", async () => {
    const prisma = {
      season: { findUnique: vi.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;
    const service = new LibraryService(
      prisma,
      {} as MediaItemService,
      {} as AgeGateService,
      {} as ReviewService,
      { emit: vi.fn() } as unknown as ActivityService,
      {} as EntitlementService,
      stubXp(),
      stubAchievements(),
    );

    await expect(service.unwatchSeason("user-1", "missing")).rejects.toThrow(
      "Season not found",
    );
  });
});

describe("LibraryService.deleteEntry", () => {
  it("wipes watches, reviews, and comments for the removed work, not just the entry row", async () => {
    const seasons = [
      { id: "s1", episodes: [{ id: "e1" }, { id: "e2" }] },
      { id: "s2", episodes: [{ id: "e3" }] },
    ];
    const episodeWatchDeleteMany = vi.fn().mockResolvedValue({ count: 2 });
    const reviewDeleteMany = vi.fn().mockResolvedValue({ count: 1 });
    const commentUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
    const libraryEntryDelete = vi.fn().mockResolvedValue({});

    const prisma = {
      libraryEntry: {
        findUnique: vi.fn().mockResolvedValue({
          id: "entry-1",
          userId: "user-1",
          mediaItemId: "media-1",
        }),
        delete: libraryEntryDelete,
      },
      season: { findMany: vi.fn().mockResolvedValue(seasons) },
      episodeWatch: {
        // Loaded before the transaction (see deleteEntry) so revokeBySource
        // has ids to work with — same rows the transaction below deletes.
        findMany: vi
          .fn()
          .mockResolvedValue([{ id: "w1" }, { id: "w2" }, { id: "w3" }]),
        deleteMany: episodeWatchDeleteMany,
      },
      review: {
        findMany: vi.fn().mockResolvedValue([]),
        deleteMany: reviewDeleteMany,
      },
      comment: { updateMany: commentUpdateMany },
      $transaction: vi.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    } as unknown as PrismaService;

    const service = new LibraryService(
      prisma,
      {} as MediaItemService,
      {} as AgeGateService,
      {} as ReviewService,
      { emit: vi.fn() } as unknown as ActivityService,
      {} as EntitlementService,
      stubXp(),
      stubAchievements(),
    );

    await service.deleteEntry("user-1", "entry-1");

    const allTargetIds = ["media-1", "s1", "s2", "e1", "e2", "e3"];

    expect(episodeWatchDeleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1", episodeId: { in: ["e1", "e2", "e3"] } },
    });
    expect(reviewDeleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1", targetId: { in: allTargetIds } },
    });
    expect(commentUpdateMany).toHaveBeenCalledWith({
      where: {
        authorId: "user-1",
        targetId: { in: allTargetIds },
        deletedAt: null,
      },
      data: { text: null, deletedAt: expect.any(Date) },
    });
    expect(libraryEntryDelete).toHaveBeenCalledWith({
      where: { id: "entry-1" },
    });
  });

  it("still works for a movie entry with no seasons/episodes", async () => {
    const prisma = {
      libraryEntry: {
        findUnique: vi.fn().mockResolvedValue({
          id: "entry-2",
          userId: "user-1",
          mediaItemId: "media-2",
        }),
        delete: vi.fn().mockResolvedValue({}),
      },
      season: { findMany: vi.fn().mockResolvedValue([]) },
      episodeWatch: {
        findMany: vi.fn().mockResolvedValue([]),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      review: {
        findMany: vi.fn().mockResolvedValue([]),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      comment: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
      $transaction: vi.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    } as unknown as PrismaService;

    const service = new LibraryService(
      prisma,
      {} as MediaItemService,
      {} as AgeGateService,
      {} as ReviewService,
      { emit: vi.fn() } as unknown as ActivityService,
      {} as EntitlementService,
      stubXp(),
      stubAchievements(),
    );

    await expect(
      service.deleteEntry("user-1", "entry-2"),
    ).resolves.toBeUndefined();
  });
});

describe("LibraryService.getCalendarIcs", () => {
  function makeService(user: { id: string } | null, hasPremium: boolean) {
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue(user) },
      episode: { findMany: vi.fn().mockResolvedValue([]) },
    } as unknown as PrismaService;
    const entitlements = {
      isEffectivelyPremium: vi.fn().mockResolvedValue(hasPremium),
    } as unknown as EntitlementService;
    return new LibraryService(
      prisma,
      {} as MediaItemService,
      {} as AgeGateService,
      {} as ReviewService,
      { emit: vi.fn() } as unknown as ActivityService,
      entitlements,
      stubXp(),
      stubAchievements(),
    );
  }

  it("returns the feed for a premium user with a valid token", async () => {
    const service = makeService({ id: "user-1" }, true);
    await expect(service.getCalendarIcs("tok")).resolves.not.toBeNull();
  });

  it("returns null for a non-premium user, even with a valid token", async () => {
    const service = makeService({ id: "user-1" }, false);
    await expect(service.getCalendarIcs("tok")).resolves.toBeNull();
  });

  it("returns null when the token matches no account", async () => {
    const service = makeService(null, true);
    await expect(service.getCalendarIcs("tok")).resolves.toBeNull();
  });
});

describe("LibraryService — XP wiring", () => {
  function entryRow(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      id: "entry-1",
      mediaItemId: "media-1",
      status: overrides.status ?? "PLANNED",
      notes: null,
      favorite: false,
      startedAt: null,
      finishedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      mediaItem: {
        id: "media-1",
        type: overrides.type ?? "MOVIE",
        title: "Arrival",
        posterUrl: null,
        canonicalSource: "TMDB",
        status: "Ended",
        externalIds: [],
      },
      replays: [],
      ...overrides,
    };
  }

  it("awards WORK_ADDED + DOMAIN_STARTED only on true first creation, and MOVIE_WATCHED on the COMPLETED transition", async () => {
    const findUnique = vi.fn().mockResolvedValueOnce(null); // before: null -> creation
    const upsert = vi
      .fn()
      .mockResolvedValue(entryRow({ status: "COMPLETED", type: "MOVIE" }));
    const count = vi.fn().mockResolvedValue(1);
    const prisma = {
      libraryEntry: { findUnique, upsert, count },
      episode: { findMany: vi.fn().mockResolvedValue([]) },
      episodeWatch: {
        aggregate: vi.fn().mockResolvedValue({ _max: { watchedAt: null } }),
      },
    } as unknown as PrismaService;
    const xp = stubXp();
    const achievements = stubAchievements();

    const service = new LibraryService(
      prisma,
      {
        upsertFromSource: vi
          .fn()
          .mockResolvedValue({ id: "media-1", type: "MOVIE" }),
      } as unknown as MediaItemService,
      {} as AgeGateService,
      {
        getRating: vi.fn().mockResolvedValue(null),
      } as unknown as ReviewService,
      { emit: vi.fn() } as unknown as ActivityService,
      {} as EntitlementService,
      xp,
      achievements,
    );

    await service.upsertEntry("user-1", {
      source: "TMDB",
      sourceId: "1",
      type: "MOVIE",
      status: "COMPLETED",
    } as never);

    expect(xp.award).toHaveBeenCalledWith("user-1", "WORK_ADDED", "entry-1");
    expect(xp.award).toHaveBeenCalledWith("user-1", "DOMAIN_STARTED", "MEDIA");
    expect(xp.award).toHaveBeenCalledWith("user-1", "MOVIE_WATCHED", "entry-1");
    expect(achievements.evaluate).toHaveBeenCalledWith(
      "user-1",
      ACHIEVEMENT_KEYS_BY_XP_REASON.MOVIE_WATCHED,
    );
  });

  it("awards MOVIE_WATCHED and evaluates achievements on updateEntry's COMPLETED transition", async () => {
    const findUnique = vi.fn().mockResolvedValue({
      userId: "user-1",
      status: "PLANNED",
      favorite: false,
    });
    const update = vi
      .fn()
      .mockResolvedValue(entryRow({ status: "COMPLETED", type: "MOVIE" }));
    const prisma = {
      libraryEntry: { findUnique, update },
      episode: { findMany: vi.fn().mockResolvedValue([]) },
      episodeWatch: {
        findMany: vi.fn().mockResolvedValue([]),
        aggregate: vi.fn().mockResolvedValue({ _max: { watchedAt: null } }),
      },
    } as unknown as PrismaService;
    const xp = stubXp();
    const achievements = stubAchievements();

    const service = new LibraryService(
      prisma,
      {} as MediaItemService,
      {} as AgeGateService,
      {
        getRating: vi.fn().mockResolvedValue(null),
      } as unknown as ReviewService,
      { emit: vi.fn() } as unknown as ActivityService,
      {} as EntitlementService,
      xp,
      achievements,
    );

    await service.updateEntry("user-1", "entry-1", {
      status: "COMPLETED",
      finishedAt: "2026-08-01T00:00:00.000Z",
    } as never);

    expect(xp.award).toHaveBeenCalledWith("user-1", "MOVIE_WATCHED", "entry-1");
    expect(achievements.evaluate).toHaveBeenCalledWith(
      "user-1",
      ACHIEVEMENT_KEYS_BY_XP_REASON.MOVIE_WATCHED,
    );
  });

  it("does not award WORK_ADDED/DOMAIN_STARTED on an update (before !== null)", async () => {
    const findUnique = vi
      .fn()
      .mockResolvedValueOnce({ status: "PLANNED", favorite: false })
      .mockResolvedValueOnce({ status: "PLANNED", finishedAt: null });
    const upsert = vi.fn().mockResolvedValue(entryRow({ status: "PLANNED" }));
    const prisma = {
      libraryEntry: { findUnique, upsert, count: vi.fn() },
      episode: { findMany: vi.fn().mockResolvedValue([]) },
      episodeWatch: {
        aggregate: vi.fn().mockResolvedValue({ _max: { watchedAt: null } }),
      },
    } as unknown as PrismaService;
    const xp = stubXp();
    const achievements = stubAchievements();

    const service = new LibraryService(
      prisma,
      {
        upsertFromSource: vi
          .fn()
          .mockResolvedValue({ id: "media-1", type: "MOVIE" }),
      } as unknown as MediaItemService,
      {} as AgeGateService,
      {
        getRating: vi.fn().mockResolvedValue(null),
      } as unknown as ReviewService,
      { emit: vi.fn() } as unknown as ActivityService,
      {} as EntitlementService,
      xp,
      achievements,
    );

    await service.upsertEntry("user-1", {
      source: "TMDB",
      sourceId: "1",
      type: "MOVIE",
      status: "PLANNED",
    } as never);

    expect(xp.award).not.toHaveBeenCalledWith(
      "user-1",
      "WORK_ADDED",
      expect.anything(),
    );
    expect(xp.award).not.toHaveBeenCalledWith(
      "user-1",
      "DOMAIN_STARTED",
      expect.anything(),
    );
  });

  it("awards MOVIE_REPLAYED on addReplay and revokes it on deleteReplay", async () => {
    const prisma = {
      libraryEntry: {
        // assertEntryOwnership (called once from addReplay, once from the
        // getEntry() it returns) and getEntry's own findUniqueOrThrow.
        findUnique: vi.fn().mockResolvedValue({
          id: "entry-1",
          userId: "user-1",
          mediaItemId: "media-1",
        }),
        findUniqueOrThrow: vi
          .fn()
          .mockResolvedValue(entryRow({ status: "COMPLETED" })),
      },
      mediaItem: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ type: "MOVIE" }),
      },
      movieReplay: {
        create: vi.fn().mockResolvedValue({ id: "replay-1" }),
        findUnique: vi.fn().mockResolvedValue({
          id: "replay-1",
          libraryEntry: { userId: "user-1" },
        }),
        delete: vi.fn().mockResolvedValue({}),
      },
      episode: { findMany: vi.fn().mockResolvedValue([]) },
      episodeWatch: {
        aggregate: vi.fn().mockResolvedValue({ _max: { watchedAt: null } }),
      },
    } as unknown as PrismaService;
    const xp = stubXp();
    const achievements = stubAchievements();

    const service = new LibraryService(
      prisma,
      {} as MediaItemService,
      {} as AgeGateService,
      {
        getRating: vi.fn().mockResolvedValue(null),
      } as unknown as ReviewService,
      { emit: vi.fn() } as unknown as ActivityService,
      {} as EntitlementService,
      xp,
      achievements,
    );

    await service.addReplay("user-1", "entry-1", {} as never);
    expect(xp.award).toHaveBeenCalledWith(
      "user-1",
      "MOVIE_REPLAYED",
      "replay-1",
    );

    await service.deleteReplay("user-1", "replay-1");
    expect(xp.revokeBySource).toHaveBeenCalledWith("MovieReplay", ["replay-1"]);
  });

  it("awards SEASON_COMPLETED once every aired episode of the season has been watched", async () => {
    const episode = {
      id: "ep2",
      seasonId: "season-1",
      airDate: null as Date | null,
      season: { mediaItemId: "media-1", mediaItem: { type: "SERIES" } },
    };
    const prisma = {
      episode: {
        findUnique: vi.fn().mockResolvedValue(episode),
        findMany: vi.fn().mockResolvedValue([
          { id: "ep1", number: 1, airDate: null, season: { number: 1 } },
          { id: "ep2", number: 2, airDate: null, season: { number: 1 } },
        ]),
      },
      episodeWatch: {
        create: vi.fn().mockResolvedValue({
          id: "w1",
          episodeId: "ep2",
          watchedAt: new Date(),
        }),
        findMany: vi
          .fn()
          .mockResolvedValue([{ episodeId: "ep1" }, { episodeId: "ep2" }]),
      },
      season: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            { id: "season-1", mediaItemId: "media-1", number: 1 },
          ]),
        findUnique: vi.fn().mockResolvedValue({
          number: 1,
          episodes: [
            { id: "ep1", airDate: null },
            { id: "ep2", airDate: null },
          ],
        }),
      },
      libraryEntry: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ status: "WATCHING", finishedAt: null }),
        findMany: vi.fn().mockResolvedValue([]), // no matching entry -> no SERIES_COMPLETED check
        update: vi.fn().mockResolvedValue({}),
      },
    } as unknown as PrismaService;
    const xp = stubXp();
    const achievements = stubAchievements();

    const service = new LibraryService(
      prisma,
      {} as MediaItemService,
      {} as AgeGateService,
      {} as ReviewService,
      { emit: vi.fn() } as unknown as ActivityService,
      {} as EntitlementService,
      xp,
      achievements,
    );

    await service.watchEpisode("user-1", "ep2", {} as never);

    expect(xp.award).toHaveBeenCalledWith(
      "user-1",
      "SEASON_COMPLETED",
      "season-1",
    );
    expect(achievements.evaluate).toHaveBeenCalledWith(
      "user-1",
      ACHIEVEMENT_KEYS_BY_XP_REASON.EPISODE_WATCHED,
    );
  });
});
