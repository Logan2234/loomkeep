import { vi } from "vitest";
import type { AchievementService } from "../gamification/achievements/achievement.service";
import type { XpService } from "../gamification/xp.service";
import type { PrismaService } from "../prisma/prisma.service";
import type { AgeGateService } from "../users/age-gate.service";
import type { BookItemService } from "./book-item.service";
import { BookLibraryService } from "./book-library.service";

// Stubbed no-op, same pattern as library.service.spec.ts (G1) — the XP
// wiring's actual crediting/reasons is asserted below via these mocks.
function stubXp(): XpService {
  return {
    award: vi.fn(),
    awardMany: vi.fn(),
    revokeBySource: vi.fn(),
  } as unknown as XpService;
}

function stubAchievements(): AchievementService {
  return { evaluate: vi.fn() } as unknown as AchievementService;
}

function makeRow(overrides: Partial<Record<string, unknown>> = {}) {
  const id = (overrides.id as string) ?? "entry-1";
  return {
    id,
    userId: "user-1",
    bookItemId: `book-${id}`,
    status: overrides.status ?? "TO_READ",
    rating: overrides.rating ?? null,
    notes: null,
    favorite: overrides.favorite ?? false,
    currentPage: overrides.currentPage ?? 0,
    startedAt: null,
    finishedAt: overrides.finishedAt ?? null,
    ownershipStatus: "NONE",
    ownershipSource: null,
    createdAt: overrides.createdAt ?? new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    replays: [],
    bookItem: {
      id: `book-${id}`,
      title: overrides.title ?? "Dune",
      authors: overrides.authors ?? ["Frank Herbert"],
      coverUrl: null,
      pageCount: overrides.pageCount ?? null,
      canonicalSource: "OPEN_LIBRARY",
      externalIds: [{ source: "OPEN_LIBRARY", externalId: `ol-${id}` }],
    },
  };
}

function makeService(rows: ReturnType<typeof makeRow>[]) {
  const prisma = {
    bookEntry: { findMany: vi.fn().mockResolvedValue(rows) },
  } as unknown as PrismaService;
  const reviews = {
    getRatings: vi.fn(() =>
      Promise.resolve(
        new Map(
          rows
            .filter((r) => r.rating !== null)
            .map((r) => [r.bookItemId, r.rating]),
        ),
      ),
    ),
    getRating: vi.fn((_u: string, _t: string, id: string) =>
      Promise.resolve(rows.find((r) => r.bookItemId === id)?.rating ?? null),
    ),
    setRating: vi.fn(),
  } as unknown as import("../reviews/review.service").ReviewService;
  const service = new BookLibraryService(
    prisma,
    {} as BookItemService,
    {} as AgeGateService,
    reviews,
    {
      emit: vi.fn(),
    } as unknown as import("../social/activity.service").ActivityService,
    stubXp(),
    stubAchievements(),
  );
  return { service, prisma };
}

describe("BookLibraryService.listEntries", () => {
  it("paginates and reports total/hasMore", async () => {
    const rows = Array.from({ length: 45 }, (_, i) =>
      makeRow({ id: `e${i}`, title: `Book ${i}` }),
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
      makeRow({ id: "a", title: "Dune" }),
      makeRow({ id: "b", title: "Foundation" }),
    ];
    const { service } = makeService(rows);

    const result = await service.listEntries("user-1", { q: "dun" });
    expect(result.items.map((i) => i.id)).toEqual(["a"]);
  });

  it("sorts by pages, descending by default", async () => {
    const rows = [
      makeRow({ id: "a", pageCount: 200 }),
      makeRow({ id: "b", pageCount: 900 }),
    ];
    const { service } = makeService(rows);

    const result = await service.listEntries("user-1", { sort: "pages" });
    expect(result.items.map((i) => i.id)).toEqual(["b", "a"]);
  });
});

describe("BookLibraryService.deleteEntry", () => {
  it("wipes the user's reviews and comments for the book, not just the entry row", async () => {
    const reviewDeleteMany = vi.fn().mockResolvedValue({ count: 1 });
    const commentUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
    const bookEntryDelete = vi.fn().mockResolvedValue({});

    const prisma = {
      bookEntry: {
        findUnique: vi.fn().mockResolvedValue({
          id: "entry-1",
          userId: "user-1",
          bookItemId: "book-1",
        }),
        delete: bookEntryDelete,
      },
      review: {
        findMany: vi.fn().mockResolvedValue([]),
        deleteMany: reviewDeleteMany,
      },
      comment: { updateMany: commentUpdateMany },
      bookReplay: { findMany: vi.fn().mockResolvedValue([]) },
      $transaction: vi.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    } as unknown as PrismaService;
    const xp = stubXp();

    const service = new BookLibraryService(
      prisma,
      {} as BookItemService,
      {} as AgeGateService,
      {} as import("../reviews/review.service").ReviewService,
      {
        emit: vi.fn(),
      } as unknown as import("../social/activity.service").ActivityService,
      xp,
      stubAchievements(),
    );

    await service.deleteEntry("user-1", "entry-1");

    expect(reviewDeleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1", targetId: "book-1" },
    });
    expect(commentUpdateMany).toHaveBeenCalledWith({
      where: { authorId: "user-1", targetId: "book-1", deletedAt: null },
      data: { text: null, deletedAt: expect.any(Date) },
    });
    expect(bookEntryDelete).toHaveBeenCalledWith({ where: { id: "entry-1" } });
    expect(xp.revokeBySource).toHaveBeenCalledWith("BookEntry", ["entry-1"]);
    expect(xp.revokeBySource).toHaveBeenCalledWith("Entry", ["entry-1"]);
  });
});

// Regression: finishedAt used to only ever be set by an explicit dto field
// nothing in the UI ever sends, so a book marked READ never actually
// counted towards the reading goal (which reads finishedAt, not status).
describe("BookLibraryService — finishedAt sync", () => {
  it("sets finishedAt when a book's status is patched to READ", async () => {
    const entryRow = makeRow({ id: "e1", status: "TO_READ" });

    const findUnique = vi
      .fn()
      // assertEntryOwnership
      .mockResolvedValueOnce({ id: "e1", userId: "user-1" })
      // updateEntry's own "before" lookup
      .mockResolvedValueOnce({ status: "TO_READ", favorite: false })
      // syncFinishedAt's lookup, post-write
      .mockResolvedValueOnce({ status: "READ", finishedAt: null });
    const update = vi
      .fn()
      .mockResolvedValueOnce({ ...entryRow, status: "READ" })
      .mockResolvedValueOnce({});

    const prisma = {
      bookEntry: { findUnique, update },
    } as unknown as PrismaService;
    const reviews = {
      getRating: vi.fn().mockResolvedValue(null),
      setRating: vi.fn(),
    } as unknown as import("../reviews/review.service").ReviewService;
    const activity = {
      emit: vi.fn(),
    } as unknown as import("../social/activity.service").ActivityService;
    const service = new BookLibraryService(
      prisma,
      {} as BookItemService,
      {} as AgeGateService,
      reviews,
      activity,
      stubXp(),
      stubAchievements(),
    );

    const result = await service.updateEntry("user-1", "e1", {
      status: "READ",
    });

    expect(result.finishedAt).not.toBeNull();
    expect(update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ data: { finishedAt: expect.any(Date) } }),
    );
  });

  it("does not override finishedAt when the caller sets it explicitly", async () => {
    const entryRow = makeRow({ id: "e1", status: "TO_READ" });
    const explicit = "2026-01-15T00:00:00.000Z";

    const findUnique = vi
      .fn()
      .mockResolvedValueOnce({ id: "e1", userId: "user-1" })
      .mockResolvedValueOnce({ status: "TO_READ", favorite: false });
    const update = vi.fn().mockResolvedValueOnce({
      ...entryRow,
      status: "READ",
      finishedAt: new Date(explicit),
    });

    const prisma = {
      bookEntry: { findUnique, update },
    } as unknown as PrismaService;
    const reviews = {
      getRating: vi.fn().mockResolvedValue(null),
      setRating: vi.fn(),
    } as unknown as import("../reviews/review.service").ReviewService;
    const activity = {
      emit: vi.fn(),
    } as unknown as import("../social/activity.service").ActivityService;
    const service = new BookLibraryService(
      prisma,
      {} as BookItemService,
      {} as AgeGateService,
      reviews,
      activity,
      stubXp(),
      stubAchievements(),
    );

    const result = await service.updateEntry("user-1", "e1", {
      status: "READ",
      finishedAt: explicit,
    });

    expect(result.finishedAt).toBe(explicit);
    expect(update).toHaveBeenCalledTimes(1);
  });
});

describe("BookLibraryService reading goal", () => {
  function makeGoalPrisma(overrides: {
    goal?: { target: number } | null;
    entryCount?: number;
    replayCount?: number;
  }) {
    const readingGoalFindUnique = vi
      .fn()
      .mockResolvedValue(overrides.goal ?? null);
    const readingGoalUpsert = vi.fn().mockResolvedValue({});
    const bookEntryCount = vi.fn().mockResolvedValue(overrides.entryCount ?? 0);
    const bookReplayCount = vi
      .fn()
      .mockResolvedValue(overrides.replayCount ?? 0);

    const prisma = {
      readingGoal: {
        findUnique: readingGoalFindUnique,
        upsert: readingGoalUpsert,
      },
      bookEntry: { count: bookEntryCount },
      bookReplay: { count: bookReplayCount },
    } as unknown as PrismaService;

    return {
      prisma,
      readingGoalFindUnique,
      readingGoalUpsert,
      bookEntryCount,
      bookReplayCount,
    };
  }

  function makeGoalService(prisma: PrismaService) {
    return new BookLibraryService(
      prisma,
      {} as BookItemService,
      {} as AgeGateService,
      {} as import("../reviews/review.service").ReviewService,
      {} as unknown as import("../social/activity.service").ActivityService,
      stubXp(),
      stubAchievements(),
    );
  }

  it("reports target 0 with no goal set, but still counts progress", async () => {
    const { prisma, bookEntryCount } = makeGoalPrisma({
      goal: null,
      entryCount: 3,
    });
    const service = makeGoalService(prisma);

    const result = await service.getReadingGoal("user-1", 2026);

    expect(result).toEqual({ year: 2026, target: 0, completed: 3 });
    expect(bookEntryCount).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        finishedAt: {
          gte: new Date(Date.UTC(2026, 0, 1)),
          lt: new Date(Date.UTC(2027, 0, 1)),
        },
      },
    });
  });

  it("adds rereads (BookReplay) to the completed count", async () => {
    const { prisma } = makeGoalPrisma({
      goal: { target: 30 },
      entryCount: 10,
      replayCount: 2,
    });
    const service = makeGoalService(prisma);

    const result = await service.getReadingGoal("user-1", 2026);

    expect(result).toEqual({ year: 2026, target: 30, completed: 12 });
  });

  it("scopes the replay count to the current user's entries only", async () => {
    const { prisma, bookReplayCount } = makeGoalPrisma({ goal: null });
    const service = makeGoalService(prisma);

    await service.getReadingGoal("user-1", 2026);

    expect(bookReplayCount).toHaveBeenCalledWith({
      where: {
        finishedAt: {
          gte: new Date(Date.UTC(2026, 0, 1)),
          lt: new Date(Date.UTC(2027, 0, 1)),
        },
        bookEntry: { userId: "user-1" },
      },
    });
  });

  it("upserts the target and returns fresh progress", async () => {
    const { prisma, readingGoalUpsert } = makeGoalPrisma({
      entryCount: 5,
      replayCount: 1,
    });
    const service = makeGoalService(prisma);

    const result = await service.upsertReadingGoal("user-1", {
      year: 2026,
      target: 25,
    });

    expect(readingGoalUpsert).toHaveBeenCalledWith({
      where: { userId_year: { userId: "user-1", year: 2026 } },
      update: { target: 25 },
      create: { userId: "user-1", year: 2026, target: 25 },
    });
    expect(result).toEqual({ year: 2026, target: 25, completed: 6 });
  });
});

describe("BookLibraryService — XP wiring", () => {
  const reviews = {
    getRating: vi.fn().mockResolvedValue(null),
    setRating: vi.fn(),
  } as unknown as import("../reviews/review.service").ReviewService;
  const activity = {
    emit: vi.fn(),
  } as unknown as import("../social/activity.service").ActivityService;

  it("awards WORK_ADDED and DOMAIN_STARTED only on true first creation, not on update", async () => {
    const findUnique = vi
      .fn()
      // upsertEntry's own "before" lookup: null -> a true creation
      .mockResolvedValueOnce(null)
      // syncFinishedAt's post-write lookup
      .mockResolvedValueOnce({ status: "TO_READ", finishedAt: null });
    const upsert = vi
      .fn()
      .mockResolvedValue({ ...makeRow({ id: "e1" }), status: "TO_READ" });
    const count = vi.fn().mockResolvedValue(1);
    const prisma = {
      bookEntry: { findUnique, upsert, count },
    } as unknown as PrismaService;
    const xp = stubXp();

    const service = new BookLibraryService(
      prisma,
      {
        upsertFromSource: vi.fn().mockResolvedValue({ id: "book-1" }),
      } as unknown as BookItemService,
      {} as AgeGateService,
      reviews,
      activity,
      xp,
      stubAchievements(),
    );

    await service.upsertEntry("user-1", {
      source: "OPEN_LIBRARY",
      sourceId: "ol-1",
      status: "TO_READ",
    } as never);

    expect(xp.award).toHaveBeenCalledWith("user-1", "WORK_ADDED", "e1");
    expect(xp.award).toHaveBeenCalledWith("user-1", "DOMAIN_STARTED", "BOOKS");

    // A subsequent update (before !== null) must not re-award either.
    xp.award = vi.fn();
    findUnique
      .mockResolvedValueOnce({ status: "TO_READ", favorite: false })
      .mockResolvedValueOnce({ status: "TO_READ", finishedAt: null });

    await service.upsertEntry("user-1", {
      source: "OPEN_LIBRARY",
      sourceId: "ol-1",
      status: "TO_READ",
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

  it("awards BOOK_FINISHED on the TO_READ -> READ transition, not on other updates", async () => {
    const findUnique = vi
      .fn()
      .mockResolvedValueOnce({ status: "TO_READ", favorite: false })
      .mockResolvedValueOnce({ status: "READ", finishedAt: new Date() });
    const upsert = vi
      .fn()
      .mockResolvedValue({ ...makeRow({ id: "e1" }), status: "READ" });
    const prisma = {
      bookEntry: { findUnique, upsert, count: vi.fn().mockResolvedValue(1) },
    } as unknown as PrismaService;
    const xp = stubXp();

    const service = new BookLibraryService(
      prisma,
      {
        upsertFromSource: vi.fn().mockResolvedValue({ id: "book-1" }),
      } as unknown as BookItemService,
      {} as AgeGateService,
      reviews,
      activity,
      xp,
      stubAchievements(),
    );

    await service.upsertEntry("user-1", {
      source: "OPEN_LIBRARY",
      sourceId: "ol-1",
      status: "READ",
    } as never);

    expect(xp.award).toHaveBeenCalledWith("user-1", "BOOK_FINISHED", "e1");
  });

  it("awards BOOK_REPLAYED on addReplay and revokes it on deleteReplay", async () => {
    const findUnique = vi
      .fn()
      .mockResolvedValueOnce({ id: "e1", userId: "user-1" }); // assertEntryOwnership
    const bookEntryFindUniqueOrThrow = vi
      .fn()
      .mockResolvedValue(makeRow({ id: "e1" }));
    const replayCreate = vi.fn().mockResolvedValue({ id: "replay-1" });
    const prisma = {
      bookEntry: {
        findUnique,
        findUniqueOrThrow: bookEntryFindUniqueOrThrow,
      },
      bookReplay: {
        create: replayCreate,
        findUnique: vi.fn().mockResolvedValue({
          id: "replay-1",
          bookEntry: { userId: "user-1" },
        }),
        delete: vi.fn().mockResolvedValue({}),
      },
    } as unknown as PrismaService;
    const xp = stubXp();

    const service = new BookLibraryService(
      prisma,
      {} as BookItemService,
      {} as AgeGateService,
      reviews,
      activity,
      xp,
      stubAchievements(),
    );

    await service.addReplay("user-1", "e1", {} as never);
    expect(xp.award).toHaveBeenCalledWith(
      "user-1",
      "BOOK_REPLAYED",
      "replay-1",
    );

    await service.deleteReplay("user-1", "replay-1");
    expect(xp.revokeBySource).toHaveBeenCalledWith("BookReplay", ["replay-1"]);
  });
});
