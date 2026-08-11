import type { PrismaService } from "../prisma/prisma.service";
import type { AgeGateService } from "../users/age-gate.service";
import type { BookItemService } from "./book-item.service";
import { BookLibraryService } from "./book-library.service";

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
      canonicalSource: "GOOGLE_BOOKS",
      externalIds: [{ source: "GOOGLE_BOOKS", externalId: `gb-${id}` }],
    },
  };
}

function makeService(rows: ReturnType<typeof makeRow>[]) {
  const prisma = {
    bookEntry: { findMany: jest.fn().mockResolvedValue(rows) },
  } as unknown as PrismaService;
  const reviews = {
    getRatings: jest.fn(() =>
      Promise.resolve(
        new Map(
          rows
            .filter((r) => r.rating !== null)
            .map((r) => [r.bookItemId, r.rating]),
        ),
      ),
    ),
    getRating: jest.fn((_u: string, _t: string, id: string) =>
      Promise.resolve(rows.find((r) => r.bookItemId === id)?.rating ?? null),
    ),
    setRating: jest.fn(),
  } as unknown as import("../reviews/review.service").ReviewService;
  const service = new BookLibraryService(
    prisma,
    {} as BookItemService,
    {} as AgeGateService,
    reviews,
    {
      emit: jest.fn(),
    } as unknown as import("../social/activity.service").ActivityService,
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
    const reviewDeleteMany = jest.fn().mockResolvedValue({ count: 1 });
    const commentUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
    const bookEntryDelete = jest.fn().mockResolvedValue({});

    const prisma = {
      bookEntry: {
        findUnique: jest.fn().mockResolvedValue({
          id: "entry-1",
          userId: "user-1",
          bookItemId: "book-1",
        }),
        delete: bookEntryDelete,
      },
      review: { deleteMany: reviewDeleteMany },
      comment: { updateMany: commentUpdateMany },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    } as unknown as PrismaService;

    const service = new BookLibraryService(
      prisma,
      {} as BookItemService,
      {} as AgeGateService,
      {} as import("../reviews/review.service").ReviewService,
      {
        emit: jest.fn(),
      } as unknown as import("../social/activity.service").ActivityService,
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
  });
});

// Regression: finishedAt used to only ever be set by an explicit dto field
// nothing in the UI ever sends, so a book marked READ never actually
// counted towards the reading goal (which reads finishedAt, not status).
describe("BookLibraryService — finishedAt sync", () => {
  it("sets finishedAt when a book's status is patched to READ", async () => {
    const entryRow = makeRow({ id: "e1", status: "TO_READ" });

    const findUnique = jest
      .fn()
      // assertEntryOwnership
      .mockResolvedValueOnce({ id: "e1", userId: "user-1" })
      // updateEntry's own "before" lookup
      .mockResolvedValueOnce({ status: "TO_READ", favorite: false })
      // syncFinishedAt's lookup, post-write
      .mockResolvedValueOnce({ status: "READ", finishedAt: null });
    const update = jest
      .fn()
      .mockResolvedValueOnce({ ...entryRow, status: "READ" })
      .mockResolvedValueOnce({});

    const prisma = {
      bookEntry: { findUnique, update },
    } as unknown as PrismaService;
    const reviews = {
      getRating: jest.fn().mockResolvedValue(null),
      setRating: jest.fn(),
    } as unknown as import("../reviews/review.service").ReviewService;
    const activity = {
      emit: jest.fn(),
    } as unknown as import("../social/activity.service").ActivityService;
    const service = new BookLibraryService(
      prisma,
      {} as BookItemService,
      {} as AgeGateService,
      reviews,
      activity,
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

    const findUnique = jest
      .fn()
      .mockResolvedValueOnce({ id: "e1", userId: "user-1" })
      .mockResolvedValueOnce({ status: "TO_READ", favorite: false });
    const update = jest.fn().mockResolvedValueOnce({
      ...entryRow,
      status: "READ",
      finishedAt: new Date(explicit),
    });

    const prisma = {
      bookEntry: { findUnique, update },
    } as unknown as PrismaService;
    const reviews = {
      getRating: jest.fn().mockResolvedValue(null),
      setRating: jest.fn(),
    } as unknown as import("../reviews/review.service").ReviewService;
    const activity = {
      emit: jest.fn(),
    } as unknown as import("../social/activity.service").ActivityService;
    const service = new BookLibraryService(
      prisma,
      {} as BookItemService,
      {} as AgeGateService,
      reviews,
      activity,
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
    const readingGoalFindUnique = jest
      .fn()
      .mockResolvedValue(overrides.goal ?? null);
    const readingGoalUpsert = jest.fn().mockResolvedValue({});
    const bookEntryCount = jest
      .fn()
      .mockResolvedValue(overrides.entryCount ?? 0);
    const bookReplayCount = jest
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
