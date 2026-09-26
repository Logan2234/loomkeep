import { vi } from "vitest";
import type { EventsGateway } from "../events/events.gateway";
import type { XpService } from "../gamification/xp.service";
import type { PrismaService } from "../prisma/prisma.service";
import type { MusicItemService } from "./music-item.service";
import { MusicLibraryService } from "./music-library.service";

function stubXp(): XpService {
  return {
    award: vi.fn(),
    awardMany: vi.fn(),
    revokeBySource: vi.fn(),
  } as unknown as XpService;
}

function stubEvents(): EventsGateway {
  return { emitToUser: vi.fn() } as unknown as EventsGateway;
}

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
      review: {
        findMany: vi.fn().mockResolvedValue([]),
        deleteMany: reviewDeleteMany,
      },
      comment: { updateMany: commentUpdateMany },
      $transaction: vi.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    } as unknown as PrismaService;
    const xp = stubXp();

    const service = new MusicLibraryService(
      prisma,
      {} as MusicItemService,
      {} as import("../reviews/review.service").ReviewService,
      {
        emit: vi.fn(),
      } as unknown as import("../social/activity.service").ActivityService,
      xp,
      stubEvents(),
    );

    await service.deleteEntry("user-1", "entry-1");

    expect(reviewDeleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1", targetId: { in: ["album-1"] } },
    });
    expect(commentUpdateMany).toHaveBeenCalledWith({
      where: {
        authorId: "user-1",
        targetId: { in: ["album-1"] },
        deletedAt: null,
      },
      data: { text: null, deletedAt: expect.any(Date) },
    });
    expect(musicEntryDelete).toHaveBeenCalledWith({
      where: { id: "entry-1" },
    });
    expect(xp.revokeBySource).toHaveBeenCalledWith("MusicEntry", ["entry-1"]);
    expect(xp.revokeBySource).toHaveBeenCalledWith("Entry", ["entry-1"]);
  });
});

describe("MusicLibraryService — XP wiring", () => {
  it("awards WORK_ADDED + DOMAIN_STARTED on creation only, and ALBUM_LISTENED on the LISTENED transition", async () => {
    const findUnique = vi.fn().mockResolvedValueOnce(null); // before: null -> creation
    const upsert = vi
      .fn()
      .mockResolvedValue({ ...makeRow({ id: "e1" }), status: "LISTENED" });
    const count = vi.fn().mockResolvedValue(1);
    const prisma = {
      musicEntry: { findUnique, upsert, count },
    } as unknown as PrismaService;
    const xp = stubXp();
    const reviews = {
      getRating: vi.fn().mockResolvedValue(null),
      setRating: vi.fn(),
    } as unknown as import("../reviews/review.service").ReviewService;

    const events = stubEvents();
    const service = new MusicLibraryService(
      prisma,
      {
        upsertFromSource: vi.fn().mockResolvedValue({ id: "album-1" }),
      } as unknown as MusicItemService,
      reviews,
      {
        emit: vi.fn(),
      } as unknown as import("../social/activity.service").ActivityService,
      xp,
      events,
    );

    await service.upsertEntry("user-1", {
      source: "MUSICBRAINZ",
      sourceId: "mbid-1",
      status: "LISTENED",
    } as never);

    expect(xp.award).toHaveBeenCalledWith("user-1", "WORK_ADDED", "e1");
    expect(xp.award).toHaveBeenCalledWith("user-1", "DOMAIN_STARTED", "MUSIC");
    expect(xp.award).toHaveBeenCalledWith("user-1", "ALBUM_LISTENED", "e1");
    expect(events.emitToUser).toHaveBeenCalledWith(
      "user-1",
      "onboarding-updated",
    );
  });
});
