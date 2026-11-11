import { vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import { AdultImageKeysService } from "./adult-image-keys.service";
import { imageKey } from "./adult-images.util";

const POSTER = "https://image.tmdb.org/t/p/w500/p.jpg";
const BACKDROP = "https://image.tmdb.org/t/p/w1280/b.jpg";
const COVER = "https://images.igdb.com/igdb/image/upload/t_cover_big/c.jpg";

function make() {
  const prisma = {
    mediaItem: {
      findMany: vi
        .fn()
        .mockResolvedValue([{ posterUrl: POSTER, backdropUrl: null }]),
    },
    gameItem: {
      findMany: vi
        .fn()
        .mockResolvedValue([{ coverUrl: COVER, backdropUrl: BACKDROP }]),
    },
    sagaMember: { findMany: vi.fn().mockResolvedValue([]) },
    gameSagaMember: { findMany: vi.fn().mockResolvedValue([]) },
  };
  const service = new AdultImageKeysService(prisma as unknown as PrismaService);
  return { service, prisma };
}

describe("AdultImageKeysService", () => {
  afterEach(() => vi.useRealTimers());

  it("collects every stored 18+ image, missing ones skipped", async () => {
    const { service, prisma } = make();

    expect(await service.get()).toEqual(
      new Set([imageKey(POSTER), imageKey(COVER), imageKey(BACKDROP)]),
    );
    expect(prisma.mediaItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isAdult: true } }),
    );
  });

  it("reuses the list for five minutes, then reloads it", async () => {
    vi.useFakeTimers();
    const { service, prisma } = make();

    await service.get();
    vi.advanceTimersByTime(4 * 60 * 1000);
    await service.get();
    expect(prisma.mediaItem.findMany).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(2 * 60 * 1000);
    await service.get();
    expect(prisma.mediaItem.findMany).toHaveBeenCalledTimes(2);
  });

  it("tries again on the next request after a failed load", async () => {
    const { service, prisma } = make();
    prisma.mediaItem.findMany.mockRejectedValueOnce(new Error("db down"));

    await expect(service.get()).rejects.toThrow("db down");
    expect(await service.get()).toContain(imageKey(POSTER));
  });
});
