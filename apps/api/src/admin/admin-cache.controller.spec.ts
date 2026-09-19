import { vi } from "vitest";
import { AdminCacheController } from "./admin-cache.controller";

describe("AdminCacheController.removeOrphans", () => {
  it("preserves items with content and reports actual deleted and skipped counts", async () => {
    const prisma = {
      mediaItem: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            { id: "reviewed" },
            { id: "commented" },
            { id: "active" },
            { id: "deletable-1" },
            { id: "deletable-2" },
          ]),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      review: {
        findMany: vi.fn().mockResolvedValue([{ targetId: "reviewed" }]),
      },
      comment: {
        findMany: vi.fn().mockResolvedValue([{ targetId: "commented" }]),
      },
      activityEvent: {
        findMany: vi.fn().mockResolvedValue([{ targetId: "active" }]),
      },
    };
    const controller = new AdminCacheController(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(controller.removeOrphans("MEDIA")).resolves.toEqual({
      deleted: 1,
      skipped: 3,
    });
    expect(prisma.mediaItem.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["deletable-1", "deletable-2"] } },
    });
  });
});
