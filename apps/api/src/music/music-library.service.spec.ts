import { vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import type { MusicItemService } from "./music-item.service";
import { MusicLibraryService } from "./music-library.service";

function makeRow(overrides: Partial<Record<string, unknown>> = {}) {
  const id = (overrides.id as string) ?? "entry-1";
  return {
    id,
    userId: "user-1",
    musicItemId: `album-${id}`,
    status: overrides.status ?? "TO_LISTEN",
    rating: overrides.rating ?? null,
    notes: null,
    favorite: overrides.favorite ?? false,
    startedAt: null,
    finishedAt: overrides.finishedAt ?? null,
    ownershipStatus: "NONE",
    ownershipSource: null,
    createdAt: overrides.createdAt ?? new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    musicItem: {
      id: `album-${id}`,
      title: overrides.title ?? "Discovery",
      artists: overrides.artists ?? ["Daft Punk"],
      coverUrl: null,
      albumType: "Album",
      canonicalSource: "MUSICBRAINZ",
      externalIds: [{ source: "MUSICBRAINZ", externalId: `mbid-${id}` }],
    },
  };
}

function makeService(rows: ReturnType<typeof makeRow>[]) {
  const prisma = {
    musicEntry: { findMany: vi.fn().mockResolvedValue(rows) },
  } as unknown as PrismaService;
  const reviews = {
    getRatings: vi.fn(() =>
      Promise.resolve(
        new Map(
          rows
            .filter((r) => r.rating !== null)
            .map((r) => [r.musicItemId, r.rating]),
        ),
      ),
    ),
    getRating: vi.fn((_u: string, _t: string, id: string) =>
      Promise.resolve(rows.find((r) => r.musicItemId === id)?.rating ?? null),
    ),
    setRating: vi.fn(),
  } as unknown as import("../reviews/review.service").ReviewService;
  const service = new MusicLibraryService(
    prisma,
    {} as MusicItemService,
    reviews,
    {
      emit: vi.fn(),
    } as unknown as import("../social/activity.service").ActivityService,
  );
  return { service, prisma };
}

describe("MusicLibraryService.listEntries", () => {
  it("paginates and reports total/hasMore", async () => {
    const rows = Array.from({ length: 45 }, (_, i) =>
      makeRow({ id: `e${i}`, title: `Album ${i}` }),
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
    expect(result.total).toBe(1);
  });

  it("filters by free-text title search, case-insensitive", async () => {
    const rows = [
      makeRow({ id: "a", title: "Discovery" }),
      makeRow({ id: "b", title: "Random Access Memories" }),
    ];
    const { service } = makeService(rows);

    const result = await service.listEntries("user-1", { q: "disco" });
    expect(result.items.map((i) => i.id)).toEqual(["a"]);
  });

  it("sorts by title (natural order ascending) and negates on order=asc", async () => {
    const rows = [
      makeRow({ id: "a", title: "Zebra" }),
      makeRow({ id: "b", title: "Alpha" }),
    ];
    const { service } = makeService(rows);

    const natural = await service.listEntries("user-1", { sort: "title" });
    expect(natural.items.map((i) => i.id)).toEqual(["b", "a"]);

    const negated = await service.listEntries("user-1", {
      sort: "title",
      order: "asc",
    });
    expect(negated.items.map((i) => i.id)).toEqual(["a", "b"]);
  });
});

describe("MusicLibraryService.deleteEntry", () => {
  it("wipes the user's reviews and comments for the album, not just the entry row", async () => {
    const reviewDeleteMany = vi.fn().mockResolvedValue({ count: 1 });
    const commentUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
    const musicEntryDelete = vi.fn().mockResolvedValue({});

    const prisma = {
      musicEntry: {
        findUnique: vi.fn().mockResolvedValue({
          id: "entry-1",
          userId: "user-1",
          musicItemId: "album-1",
        }),
        delete: musicEntryDelete,
      },
      review: { deleteMany: reviewDeleteMany },
      comment: { updateMany: commentUpdateMany },
      $transaction: vi.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    } as unknown as PrismaService;

    const service = new MusicLibraryService(
      prisma,
      {} as MusicItemService,
      {} as import("../reviews/review.service").ReviewService,
      {
        emit: vi.fn(),
      } as unknown as import("../social/activity.service").ActivityService,
    );

    await service.deleteEntry("user-1", "entry-1");

    expect(reviewDeleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1", targetId: "album-1" },
    });
    expect(commentUpdateMany).toHaveBeenCalledWith({
      where: { authorId: "user-1", targetId: "album-1", deletedAt: null },
      data: { text: null, deletedAt: expect.any(Date) },
    });
    expect(musicEntryDelete).toHaveBeenCalledWith({
      where: { id: "entry-1" },
    });
  });
});
