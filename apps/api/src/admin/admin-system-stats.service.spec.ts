import { SecurityEventType } from "@loomkeep/shared";
import { vi, type Mock } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import { AdminSystemStatsService } from "./admin-system-stats.service";
import type { AdminService } from "./admin.service";

// The computation itself lives in admin-system-stats.util (own spec). What's
// worth pinning here is the orchestration: which window each figure is read
// over, and what a missing row turns into.
function make(over: { backup?: unknown; counters?: unknown[] } = {}) {
  const prisma = {
    apiCallCounter: {
      findMany: vi.fn().mockResolvedValue(over.counters ?? []),
    },
    notification: { count: vi.fn().mockResolvedValue(4) },
    pushSubscription: { count: vi.fn().mockResolvedValue(7) },
    securityEvent: { count: vi.fn().mockResolvedValue(2) },
    backupFile: {
      findFirst: vi.fn().mockResolvedValue(over.backup ?? null),
    },
  } as unknown as PrismaService;

  const admin = {
    getProviderQuotaSpecs: vi.fn().mockReturnValue([]),
  } as unknown as AdminService;

  return { service: new AdminSystemStatsService(prisma, admin), prisma };
}

describe("AdminSystemStatsService", () => {
  it("counts failed logins over the last 24 hours only", async () => {
    const { service, prisma } = make();

    await service.getStats();

    const [[call]] = (prisma.securityEvent.count as Mock).mock.calls;
    expect(call.where.type).toBe(SecurityEventType.LOGIN_FAILED);
    const since = call.where.createdAt.gte as Date;
    expect(Date.now() - since.getTime()).toBeCloseTo(24 * 60 * 60 * 1000, -4);
  });

  it("reads provider call counters for the current UTC day", async () => {
    const { service, prisma } = make();

    await service.getStats();

    const day = (prisma.apiCallCounter.findMany as Mock).mock.calls[0][0].where
      .day as Date;
    expect(day.toISOString()).toBe(
      `${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`,
    );
  });

  it("reports no backup as null rather than an empty shape", async () => {
    // The admin panel renders "aucune sauvegarde" off this — an object with
    // zeroed fields would read as a 0-byte backup having succeeded.
    const { service } = make({ backup: null });

    const stats = await service.getStats();

    expect(stats.ops.lastBackup).toBeNull();
  });

  it("serialises the most recent backup's date and size", async () => {
    const createdAt = new Date("2026-09-14T03:00:00Z");
    const { service, prisma } = make({
      backup: { createdAt, sizeBytes: 2048 },
    });

    const stats = await service.getStats();

    expect(stats.ops.lastBackup).toEqual({
      createdAt: createdAt.toISOString(),
      sizeBytes: 2048,
    });
    // Most recent, not any — the card claims to show the latest.
    expect(
      (prisma.backupFile.findFirst as Mock).mock.calls[0][0].orderBy,
    ).toEqual({ createdAt: "desc" });
  });

  it("stamps the snapshot it was generated at — none of this is historised", async () => {
    const { service } = make();

    const stats = await service.getStats();

    expect(Date.parse(stats.generatedAt)).toBeLessThanOrEqual(Date.now());
  });
});
