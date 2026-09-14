import { vi, type Mock } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import { AdminCatalogueStatsService } from "./admin-catalogue-stats.service";

// Bucketing, ranking and the reference summary live in
// admin-catalogue-stats.util / admin-stats.util, each with its own spec. What
// the service owns is which domain reports what, and how the cache's
// staleness share is measured.
function itemDelegate(count = 0) {
  return {
    count: vi.fn().mockResolvedValue(count),
    findMany: vi.fn().mockResolvedValue([]),
  };
}

function make(mediaCount = 100) {
  const prisma = {
    mediaItem: itemDelegate(mediaCount),
    gameItem: itemDelegate(),
    bookItem: itemDelegate(),
    musicItem: itemDelegate(),
    libraryEntry: { groupBy: vi.fn().mockResolvedValue([]) },
    gameEntry: { groupBy: vi.fn().mockResolvedValue([]) },
    bookEntry: { groupBy: vi.fn().mockResolvedValue([]) },
    musicEntry: { groupBy: vi.fn().mockResolvedValue([]) },
  } as unknown as PrismaService;

  return { service: new AdminCatalogueStatsService(prisma), prisma };
}

describe("AdminCatalogueStatsService", () => {
  it("reports every domain, in a stable order", async () => {
    const { service } = make();

    const stats = await service.getStats();

    expect(stats.byDomain.map((d) => d.domain)).toEqual([
      "MEDIA",
      "GAMES",
      "BOOKS",
      "MUSIC",
    ]);
  });

  it("leaves stalePercent null for every domain but MEDIA", async () => {
    // Only MEDIA has a refresh TTL to be stale against — a 0 here would read
    // as "nothing is stale" rather than "the question doesn't apply".
    const { service } = make();

    const stats = await service.getStats();

    const byDomain = new Map(stats.byDomain.map((d) => [d.domain, d]));
    expect(byDomain.get("GAMES")?.stalePercent).toBeNull();
    expect(byDomain.get("BOOKS")?.stalePercent).toBeNull();
    expect(byDomain.get("MUSIC")?.stalePercent).toBeNull();
    expect(byDomain.get("MEDIA")?.stalePercent).not.toBeNull();
  });

  it("measures staleness against the media sync TTL", async () => {
    const { service, prisma } = make();

    await service.getStats();

    const staleCall = (prisma.mediaItem.count as Mock).mock.calls.find(
      ([arg]) => arg?.where?.lastSyncedAt,
    );
    expect(staleCall).toBeDefined();
    const cutoff = staleCall![0].where.lastSyncedAt.lt as Date;
    // 24h, matching MediaItemService's own SYNC_TTL_MS.
    expect(Date.now() - cutoff.getTime()).toBeCloseTo(24 * 60 * 60 * 1000, -4);
  });

  it("counts items created before the window as the growth curve's baseline", async () => {
    // The curve is cumulative: without the pre-window count it would restart
    // from zero and claim the catalogue was just created.
    const { service, prisma } = make();

    await service.getStats();

    const baseline = (prisma.gameItem.count as Mock).mock.calls.find(
      ([arg]) => arg?.where?.createdAt?.lt,
    );
    expect(baseline).toBeDefined();
  });

  it("reports an empty catalogue without dividing by zero", async () => {
    const { service } = make(0);

    const stats = await service.getStats();

    expect(stats.byDomain.every((d) => d.items === 0)).toBe(true);
    expect(stats.orphanCount).toBe(0);
    expect(stats.popular).toEqual([]);
  });
});
