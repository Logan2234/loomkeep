import { vi } from "vitest";
import type { BookItemService } from "../books/book-item.service";
import type { MediaItemService } from "../catalog/media-item.service";
import type { GameItemService } from "../games/game-item.service";
import type { MusicItemService } from "../music/music-item.service";
import type { PrismaService } from "../prisma/prisma.service";
import { AdminCacheService } from "./admin-cache.service";

type TargetType = "MEDIA" | "SEASON" | "EPISODE";
type ContentKind = "review" | "comment" | "activityEvent";
type TargetRow = { targetType: TargetType; targetId: string };
type TargetWhere = {
  OR?: TargetWhere[];
  targetType?: string;
  targetId?: { in: string[] };
};

function matchesTarget(row: TargetRow, where: TargetWhere): boolean {
  if (where.OR) return where.OR.some((part) => matchesTarget(row, part));
  return (
    row.targetType === where.targetType &&
    (where.targetId?.in.includes(row.targetId) ?? false)
  );
}

function makeService(kind: ContentKind, targetType: TargetType) {
  const targetId =
    targetType === "MEDIA"
      ? "protected-media"
      : targetType === "SEASON"
        ? "season-1"
        : "episode-1";
  const row: TargetRow = { targetType, targetId };
  const content = (contentKind: ContentKind) => ({
    findMany: vi.fn(async ({ where }: { where: TargetWhere }) =>
      contentKind === kind && matchesTarget(row, where) ? [row] : [],
    ),
  });

  const prisma = {
    mediaItem: {
      findMany: vi
        .fn()
        .mockResolvedValue([{ id: "protected-media" }, { id: "empty-media" }]),
      findUnique: vi.fn().mockResolvedValue({ _count: { entries: 0 } }),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      delete: vi.fn().mockResolvedValue(undefined),
    },
    season: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "season-1",
          mediaItemId: "protected-media",
          episodes: [{ id: "episode-1" }],
        },
      ]),
    },
    review: content("review"),
    comment: content("comment"),
    activityEvent: content("activityEvent"),
    $transaction: vi.fn(),
  };
  prisma.$transaction.mockImplementation(
    async (action: (db: typeof prisma) => Promise<unknown>) => action(prisma),
  );
  const mediaItems = { forceRefresh: vi.fn().mockResolvedValue(undefined) };
  const service = new AdminCacheService(
    prisma as unknown as PrismaService,
    mediaItems as unknown as MediaItemService,
    {} as GameItemService,
    {} as BookItemService,
    {} as MusicItemService,
  );

  return { service, prisma, mediaItems };
}

describe("AdminCacheService media purge", () => {
  for (const kind of ["review", "comment", "activityEvent"] as const) {
    for (const targetType of ["SEASON", "EPISODE"] as const) {
      it(`skips a media item with a ${targetType} ${kind} during bulk purge`, async () => {
        const { service, prisma } = makeService(kind, targetType);

        await expect(service.removeOrphans("MEDIA")).resolves.toEqual({
          deleted: 1,
          skipped: 1,
        });
        expect(prisma.mediaItem.deleteMany).toHaveBeenCalledWith({
          where: { id: { in: ["empty-media"] }, entries: { none: {} } },
        });
        expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
          isolationLevel: "Serializable",
          timeout: 60_000,
        });
      });

      it(`rejects individual purge of a media item with a ${targetType} ${kind}`, async () => {
        const { service, prisma } = makeService(kind, targetType);

        await expect(
          service.remove("MEDIA", "protected-media"),
        ).rejects.toMatchObject({ status: 409 });
        expect(prisma.mediaItem.deleteMany).not.toHaveBeenCalled();
        expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
          isolationLevel: "Serializable",
          timeout: 60_000,
        });
      });
    }
  }

  it("still protects content attached directly to the media item", async () => {
    const { service, prisma } = makeService("review", "MEDIA");

    await expect(service.removeOrphans("MEDIA")).resolves.toEqual({
      deleted: 1,
      skipped: 1,
    });
    expect(prisma.mediaItem.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["empty-media"] }, entries: { none: {} } },
    });
  });
});

describe("AdminCacheService.resyncStale", () => {
  it("continues after a failed refresh and reports both outcomes", async () => {
    const { service, prisma, mediaItems } = makeService("review", "MEDIA");
    vi.spyOn(service["logger"], "error").mockImplementation(() => undefined);
    mediaItems.forceRefresh.mockRejectedValueOnce(new Error("provider down"));

    await expect(service.resyncStale("MEDIA")).resolves.toEqual({
      resynced: 1,
      failed: 1,
    });
    expect(mediaItems.forceRefresh.mock.calls.map(([id]) => id)).toEqual([
      "protected-media",
      "empty-media",
    ]);
    expect(prisma.mediaItem.findMany).toHaveBeenCalledWith({
      where: { lastSyncedAt: { lt: expect.any(Date) } },
      select: { id: true },
    });
  });
});
