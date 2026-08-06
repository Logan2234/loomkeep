import type { PrismaService } from "../prisma/prisma.service";
import type { ReviewService } from "../reviews/review.service";
import type { ActivityService } from "../social/activity.service";
import type { AgeGateService } from "../users/age-gate.service";
import type { MediaItemService } from "../catalog/media-item.service";
import { LibraryService } from "./library.service";

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
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    mediaItem: {
      id: `media-${id}`,
      type: overrides.type ?? "MOVIE",
      title: overrides.title ?? "Arrival",
      posterUrl: null,
      canonicalSource: "TMDB",
      status: overrides.airingStatus ?? "Ended",
      externalIds: [{ source: "TMDB", externalId: `tmdb-${id}` }],
    },
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
}

function makeService(
  rows: ReturnType<typeof makeRow>[],
  opts: ServiceOpts = {},
) {
  const prisma = {
    libraryEntry: { findMany: jest.fn().mockResolvedValue(rows) },
    // listEntries fetches episodes/watches batched across all media items
    // (`mediaItemId: { in: [...] }`) rather than one query per entry.
    episode: {
      findMany: jest.fn(
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
      findMany: jest.fn(
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
    getRatings: jest.fn(() =>
      Promise.resolve(
        new Map(
          rows
            .filter((r) => r.rating !== null)
            .map((r) => [r.mediaItemId, r.rating]),
        ),
      ),
    ),
    getRating: jest.fn((_u: string, _t: string, id: string) =>
      Promise.resolve(rows.find((r) => r.mediaItemId === id)?.rating ?? null),
    ),
    setRating: jest.fn(),
  } as unknown as ReviewService;
  const service = new LibraryService(
    prisma,
    {} as MediaItemService,
    {} as AgeGateService,
    reviews,
    { emit: jest.fn() } as unknown as ActivityService,
  );
  return { service, prisma };
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
});

// Regression: entry.finishedAt used to only ever be set by an explicit dto
// field nothing in the UI ever sends, so CommentService.isMasked's
// work-level spoiler gate (`!entry?.finishedAt`) stayed permanently true —
// a movie/series' comment thread stayed blurred forever, even to viewers
// who had actually finished it.
describe("LibraryService — finishedAt sync (comment-masking gate)", () => {
  it("sets finishedAt when a movie's status is patched to COMPLETED", async () => {
    const entryRow = makeRow({ id: "e1", type: "MOVIE", status: "PLANNED" });

    const findUnique = jest
      .fn()
      // assertEntryOwnership
      .mockResolvedValueOnce({ id: "e1", userId: "user-1" })
      // updateEntry's own "before" lookup
      .mockResolvedValueOnce({ status: "PLANNED", favorite: false })
      // syncFinishedAt's lookup, post-write
      .mockResolvedValueOnce({ status: "COMPLETED", finishedAt: null });
    const update = jest
      .fn()
      // the main entry write
      .mockResolvedValueOnce({ ...entryRow, status: "COMPLETED" })
      // syncFinishedAt's finishedAt-only write
      .mockResolvedValueOnce({});

    const prisma = {
      libraryEntry: { findUnique, update },
      episode: { findMany: jest.fn().mockResolvedValue([]) },
      episodeWatch: {
        aggregate: jest.fn().mockResolvedValue({ _max: { watchedAt: null } }),
      },
    } as unknown as PrismaService;
    const reviews = {
      getRating: jest.fn().mockResolvedValue(null),
      setRating: jest.fn(),
    } as unknown as ReviewService;
    const activity = { emit: jest.fn() } as unknown as ActivityService;
    const service = new LibraryService(
      prisma,
      {} as MediaItemService,
      {} as AgeGateService,
      reviews,
      activity,
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

    const findUnique = jest
      .fn()
      .mockResolvedValueOnce({ id: "e1", userId: "user-1" })
      .mockResolvedValueOnce({ status: "PLANNED", favorite: false });
    const update = jest.fn().mockResolvedValueOnce({
      ...entryRow,
      status: "COMPLETED",
      finishedAt: new Date(explicit),
    });

    const prisma = {
      libraryEntry: { findUnique, update },
      episode: { findMany: jest.fn().mockResolvedValue([]) },
      episodeWatch: {
        aggregate: jest.fn().mockResolvedValue({ _max: { watchedAt: null } }),
      },
    } as unknown as PrismaService;
    const reviews = {
      getRating: jest.fn().mockResolvedValue(null),
      setRating: jest.fn(),
    } as unknown as ReviewService;
    const activity = { emit: jest.fn() } as unknown as ActivityService;
    const service = new LibraryService(
      prisma,
      {} as MediaItemService,
      {} as AgeGateService,
      reviews,
      activity,
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
        findUnique: jest.fn().mockResolvedValue(episode),
        findMany: jest.fn().mockResolvedValue([
          { id: "ep1", number: 1, airDate: null, season: { number: 1 } },
          { id: "ep2", number: 2, airDate: null, season: { number: 1 } },
        ]),
      },
      episodeWatch: {
        create: jest.fn().mockResolvedValue({
          id: "w1",
          episodeId: "ep2",
          watchedAt: new Date(),
        }),
        findMany: jest
          .fn()
          .mockResolvedValue([{ episodeId: "ep1" }, { episodeId: "ep2" }]),
      },
      libraryEntry: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ status: "WATCHING", finishedAt: null }),
        update: jest.fn().mockResolvedValue({}),
      },
    } as unknown as PrismaService;
    const activity = { emit: jest.fn() } as unknown as ActivityService;
    const service = new LibraryService(
      prisma,
      {} as MediaItemService,
      {} as AgeGateService,
      {} as ReviewService,
      activity,
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

    const deleteMany = jest.fn().mockResolvedValue({ count: 2 });
    const prisma = {
      season: {
        findUnique: jest.fn().mockResolvedValue({
          mediaItemId: "media-1",
          mediaItem: { type: "SERIES" },
        }),
      },
      episode: {
        findMany: jest
          .fn()
          // unwatchSeason's own lookup (season's episode ids)
          .mockImplementationOnce(() => Promise.resolve(seasonEpisodes))
          // computeProgress, via syncFinishedAt
          .mockImplementationOnce(() => Promise.resolve(progressEpisodes)),
      },
      episodeWatch: {
        deleteMany,
        findMany: jest.fn().mockResolvedValue([]), // nothing left watched
      },
      libraryEntry: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ status: "COMPLETED", finishedAt: new Date() }),
        update: jest.fn().mockResolvedValue({}),
      },
    } as unknown as PrismaService;

    const activity = { emit: jest.fn() } as unknown as ActivityService;
    const service = new LibraryService(
      prisma,
      {} as MediaItemService,
      {} as AgeGateService,
      {} as ReviewService,
      activity,
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
      season: { findUnique: jest.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;
    const service = new LibraryService(
      prisma,
      {} as MediaItemService,
      {} as AgeGateService,
      {} as ReviewService,
      { emit: jest.fn() } as unknown as ActivityService,
    );

    await expect(service.unwatchSeason("user-1", "missing")).rejects.toThrow(
      "Season not found",
    );
  });
});
