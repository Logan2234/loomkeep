import { ErrorCode } from "@loomkeep/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BookSessionService } from "./book-session.service";

describe("BookSessionService", () => {
  const occurredAt = new Date("2026-09-26T12:00:00.000Z");
  const created = {
    id: "session-1",
    bookEntryId: "entry-1",
    readingId: null,
    durationMinutes: 45,
    pagesRead: 100,
    startPage: null,
    endPage: null,
    notes: "The ending finally clicked.",
    occurredAt,
    source: "MANUAL",
    createdAt: new Date("2026-09-26T12:01:00.000Z"),
    updatedAt: new Date("2026-09-26T12:01:00.000Z"),
  };
  const tx = {
    bookSession: {
      count: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn(),
    },
    bookEntry: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
    bookReading: {
      aggregate: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };
  const prisma = {
    bookEntry: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn() },
    bookSession: {
      aggregate: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  const activity = {
    deleteLinked: vi.fn(),
    emit: vi.fn(),
  };
  const sessionXp = {
    awardForToday: vi.fn(),
    refreshAfterDelete: vi.fn(),
  };
  const xp = { award: vi.fn() };
  const achievements = { evaluate: vi.fn() };
  let service: BookSessionService;

  beforeEach(() => {
    vi.clearAllMocks();
    tx.bookSession.create.mockImplementation(({ data }) =>
      Promise.resolve({ ...created, readingId: data.readingId }),
    );
    tx.bookSession.delete.mockResolvedValue(created);
    tx.bookSession.findMany.mockResolvedValue([
      {
        durationMinutes: 45,
        pagesRead: 100,
        startPage: null,
        endPage: null,
        occurredAt,
      },
    ]);
    tx.bookSession.count.mockResolvedValue(0);
    tx.bookEntry.findUniqueOrThrow.mockResolvedValue({
      startedAt: null,
      finishedAt: null,
    });
    tx.bookEntry.update.mockResolvedValue({});
    tx.bookReading.aggregate.mockResolvedValue({ _max: { number: null } });
    tx.bookReading.findFirst.mockResolvedValue(null);
    tx.bookReading.findUniqueOrThrow.mockResolvedValue({
      id: "reading-1",
      baselinePage: 0,
      referencePageCount: 100,
      status: "ACTIVE",
      startedAt: occurredAt,
      finishedAt: null,
    });
    tx.bookReading.update.mockImplementation(({ where, data }) =>
      Promise.resolve({
        id: where.id,
        number: 1,
        status: data.status ?? "ACTIVE",
        editionKey: "edition-1",
        referencePageCount: 100,
        baselinePage: 0,
        currentPage: data.currentPage ?? 0,
        startedAt: occurredAt,
        finishedAt: data.finishedAt ?? null,
      }),
    );
    tx.bookReading.create.mockResolvedValue({
      id: "reading-1",
      number: 1,
      status: "ACTIVE",
      editionKey: "edition-1",
      referencePageCount: 100,
      baselinePage: 0,
      currentPage: 0,
      startedAt: occurredAt,
    });
    prisma.$transaction.mockImplementation((run) => run(tx));
    prisma.bookSession.findMany
      .mockResolvedValueOnce([created])
      .mockResolvedValueOnce([
        { occurredAt, durationMinutes: 45, pagesRead: 100 },
      ]);
    prisma.bookSession.aggregate.mockResolvedValue({
      _count: 1,
      _sum: { pagesRead: 100 },
    });
    prisma.bookEntry.findUniqueOrThrow.mockResolvedValue({
      currentPage: 100,
      referencePageCount: 100,
      trackedReadingMinutes: 45,
      status: "READ",
      readings: [],
      user: { timezone: "UTC" },
    });
    activity.emit.mockResolvedValue(undefined);
    activity.deleteLinked.mockResolvedValue(undefined);
    sessionXp.awardForToday.mockResolvedValue(true);
    sessionXp.refreshAfterDelete.mockResolvedValue(undefined);
    xp.award.mockResolvedValue(true);
    achievements.evaluate.mockResolvedValue(undefined);
    service = new BookSessionService(
      prisma as never,
      activity as never,
      sessionXp as never,
      xp as never,
      achievements as never,
    );
  });

  it("marks the book as read when a session reaches the reference page count", async () => {
    prisma.bookEntry.findUnique.mockResolvedValue({
      id: "entry-1",
      userId: "user-1",
      bookItemId: "book-1",
      status: "TO_READ",
      startedAt: null,
      editionKey: "edition-1",
      referencePageCount: 100,
    });

    await service.create("user-1", "entry-1", {
      durationMinutes: 45,
      pagesRead: 100,
      occurredAt: occurredAt.toISOString(),
      notes: "  The ending finally clicked.  ",
    });

    expect(tx.bookSession.create).toHaveBeenCalledWith({
      data: {
        bookEntryId: "entry-1",
        readingId: "reading-1",
        durationMinutes: 45,
        notes: "The ending finally clicked.",
        occurredAt,
        source: "MANUAL",
        pagesRead: 100,
        startPage: null,
        endPage: null,
      },
    });
    expect(activity.emit.mock.calls[0]?.[0].data).not.toHaveProperty("notes");

    expect(tx.bookEntry.update).toHaveBeenNthCalledWith(1, {
      where: { id: "entry-1" },
      data: { trackedReadingMinutes: { increment: 45 } },
    });
    expect(tx.bookEntry.update).toHaveBeenNthCalledWith(2, {
      where: { id: "entry-1" },
      data: expect.objectContaining({
        currentPage: 100,
        status: "READ",
        startedAt: occurredAt,
        finishedAt: occurredAt,
      }),
    });
    expect(xp.award).toHaveBeenCalledWith(
      "user-1",
      "BOOK_FINISHED",
      "reading-1",
    );
    expect(achievements.evaluate).toHaveBeenCalledOnce();
  });

  it("starts a new reading at page zero without reusing completed progress", async () => {
    prisma.bookEntry.findUnique.mockResolvedValue({
      id: "entry-1",
      userId: "user-1",
      bookItemId: "book-1",
      status: "READ",
      startedAt: occurredAt,
      finishedAt: occurredAt,
      editionKey: "edition-1",
      referencePageCount: 100,
    });
    tx.bookReading.aggregate.mockResolvedValue({ _max: { number: 1 } });
    tx.bookReading.create.mockResolvedValue({
      id: "reading-2",
      number: 2,
      status: "ACTIVE",
      editionKey: "edition-1",
      referencePageCount: 100,
      baselinePage: 0,
      currentPage: 0,
      startedAt: occurredAt,
    });
    tx.bookReading.findUniqueOrThrow.mockResolvedValue({
      id: "reading-2",
      baselinePage: 0,
      referencePageCount: 100,
      status: "ACTIVE",
      startedAt: occurredAt,
      finishedAt: null,
    });
    tx.bookSession.findMany.mockResolvedValue([
      {
        durationMinutes: 45,
        pagesRead: 10,
        startPage: null,
        endPage: null,
        occurredAt,
      },
    ]);

    await service.create("user-1", "entry-1", {
      durationMinutes: 45,
      pagesRead: 10,
      occurredAt: occurredAt.toISOString(),
      cycleAction: "RESTART",
    });

    expect(tx.bookReading.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        number: 2,
        baselinePage: 0,
        currentPage: 0,
        editionKey: "edition-1",
        referencePageCount: 100,
      }),
    });
    expect(tx.bookSession.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ readingId: "reading-2" }),
    });
    expect(tx.bookEntry.update).toHaveBeenCalledWith({
      where: { id: "entry-1" },
      data: expect.objectContaining({ currentPage: 10, status: "READING" }),
    });
  });

  it("keeps a post-completion reading session out of current progress", async () => {
    prisma.bookEntry.findUnique.mockResolvedValue({
      id: "entry-1",
      userId: "user-1",
      bookItemId: "book-1",
      status: "READ",
      startedAt: occurredAt,
      finishedAt: occurredAt,
      editionKey: "edition-1",
      referencePageCount: 100,
    });

    await service.create("user-1", "entry-1", {
      durationMinutes: 45,
      pagesRead: 10,
      occurredAt: occurredAt.toISOString(),
      cycleAction: "HISTORY_ONLY",
    });

    expect(tx.bookReading.create).not.toHaveBeenCalled();
    expect(tx.bookSession.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ readingId: null }),
    });
    expect(tx.bookEntry.update.mock.calls[0]?.[0].data.currentPage).toBe(
      undefined,
    );
  });

  it("rejects a page quantity beyond the selected edition", async () => {
    prisma.bookEntry.findUnique.mockResolvedValue({
      id: "entry-1",
      userId: "user-1",
      bookItemId: "book-1",
      status: "TO_READ",
      startedAt: null,
      editionKey: "edition-1",
      referencePageCount: 100,
    });

    await expect(
      service.create("user-1", "entry-1", {
        durationMinutes: 45,
        pagesRead: 101,
        occurredAt: occurredAt.toISOString(),
      }),
    ).rejects.toMatchObject({ code: ErrorCode.LibrarySessionInvalidPages });

    expect(tx.bookSession.create).not.toHaveBeenCalled();
  });

  it("does not override an explicitly dropped book", async () => {
    prisma.bookEntry.findUnique.mockResolvedValue({
      id: "entry-1",
      userId: "user-1",
      bookItemId: "book-1",
      status: "DROPPED",
      startedAt: occurredAt,
      editionKey: "edition-1",
      referencePageCount: 100,
    });
    tx.bookEntry.findUniqueOrThrow.mockResolvedValue({
      readingBaselinePage: 0,
      referencePageCount: 100,
      status: "DROPPED",
      startedAt: occurredAt,
      finishedAt: null,
    });

    await service.create("user-1", "entry-1", {
      durationMinutes: 45,
      pagesRead: 100,
      occurredAt: occurredAt.toISOString(),
    });

    const update = tx.bookEntry.update.mock.calls[0]?.[0];
    expect(update.data.status).toBeUndefined();
    expect(xp.award).not.toHaveBeenCalled();
  });

  it("resumes a dropped book only when the session explicitly requests it", async () => {
    prisma.bookEntry.findUnique.mockResolvedValue({
      id: "entry-1",
      userId: "user-1",
      bookItemId: "book-1",
      status: "DROPPED",
      startedAt: occurredAt,
      editionKey: "edition-1",
      referencePageCount: 100,
    });
    tx.bookReading.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: "reading-1",
      number: 1,
      status: "DROPPED",
      editionKey: "edition-1",
      referencePageCount: 100,
      baselinePage: 0,
      currentPage: 20,
    });
    tx.bookSession.findMany.mockResolvedValue([
      {
        durationMinutes: 45,
        pagesRead: 10,
        startPage: null,
        endPage: null,
        occurredAt,
      },
    ]);

    await service.create("user-1", "entry-1", {
      durationMinutes: 45,
      pagesRead: 10,
      occurredAt: occurredAt.toISOString(),
      cycleAction: "CONTINUE",
    });

    expect(tx.bookEntry.update).toHaveBeenCalledWith({
      where: { id: "entry-1" },
      data: expect.objectContaining({ status: "READING" }),
    });
  });

  it("resumes a read book without immediately completing it again", async () => {
    prisma.bookEntry.findUnique.mockResolvedValue({
      id: "entry-1",
      userId: "user-1",
      bookItemId: "book-1",
      status: "READ",
      startedAt: occurredAt,
      finishedAt: occurredAt,
      editionKey: "edition-1",
      referencePageCount: 100,
    });
    tx.bookReading.findUniqueOrThrow.mockResolvedValue({
      id: "reading-2",
      baselinePage: 0,
      referencePageCount: 100,
      status: "ACTIVE",
      startedAt: occurredAt,
      finishedAt: null,
    });
    tx.bookSession.findMany.mockResolvedValue([
      {
        durationMinutes: 45,
        pagesRead: 10,
        startPage: null,
        endPage: null,
        occurredAt,
      },
    ]);

    await service.create("user-1", "entry-1", {
      durationMinutes: 45,
      pagesRead: 10,
      occurredAt: occurredAt.toISOString(),
      cycleAction: "RESTART",
    });

    expect(tx.bookEntry.update).toHaveBeenCalledWith({
      where: { id: "entry-1" },
      data: expect.objectContaining({ status: "READING" }),
    });
  });

  it("does not roll a read status back when its session is deleted", async () => {
    prisma.bookSession.findUnique.mockResolvedValue({
      ...created,
      readingId: "reading-1",
      reading: {
        id: "reading-1",
        number: 1,
        status: "COMPLETED",
        referencePageCount: 100,
      },
      bookEntry: { userId: "user-1" },
    });
    tx.bookSession.findMany.mockResolvedValue([]);
    tx.bookEntry.findUniqueOrThrow.mockResolvedValue({
      readingBaselinePage: 0,
      referencePageCount: 100,
      status: "READ",
      startedAt: occurredAt,
      finishedAt: occurredAt,
    });

    await service.delete("user-1", "session-1");

    expect(tx.bookEntry.update).toHaveBeenCalledWith({
      where: { id: "entry-1" },
      data: {
        trackedReadingMinutes: { decrement: 45 },
      },
    });
    expect(activity.deleteLinked).toHaveBeenCalledWith(
      "BookSession",
      "session-1",
    );
    expect(xp.award).not.toHaveBeenCalled();
  });

  it("returns a reading book to the to-read state when its only session is deleted", async () => {
    prisma.bookSession.findUnique.mockResolvedValue({
      ...created,
      readingId: "reading-1",
      reading: {
        id: "reading-1",
        number: 1,
        status: "ACTIVE",
        referencePageCount: 100,
      },
      bookEntry: { userId: "user-1" },
    });
    tx.bookSession.findMany.mockResolvedValue([]);
    tx.bookEntry.findUniqueOrThrow.mockResolvedValue({
      readingBaselinePage: 0,
      referencePageCount: 100,
      status: "READING",
      startedAt: occurredAt,
      finishedAt: null,
    });

    await service.delete("user-1", "session-1");

    expect(tx.bookEntry.update).toHaveBeenLastCalledWith({
      where: { id: "entry-1" },
      data: {
        currentPage: 0,
        readingBaselinePage: 0,
        status: "TO_READ",
        startedAt: null,
      },
    });
  });
});
