import { describe, expect, it, vi } from "vitest";
import type { EventsGateway } from "../events/events.gateway";
import type { PrismaService } from "../prisma/prisma.service";
import { AdminOverviewService } from "./admin-overview.service";

function makeService(connected = 3) {
  const count = vi.fn().mockResolvedValue(0);
  const prisma = {
    user: { count },
    pushSubscription: { count: vi.fn().mockResolvedValue(0) },
    mediaItem: { count: vi.fn().mockResolvedValue(0) },
    gameItem: { count: vi.fn().mockResolvedValue(0) },
    bookItem: { count: vi.fn().mockResolvedValue(0) },
    musicItem: { count: vi.fn().mockResolvedValue(0) },
  } as unknown as PrismaService;
  const events = {
    connectedUserCount: vi.fn().mockResolvedValue(connected),
  } as unknown as EventsGateway;

  return { service: new AdminOverviewService(prisma, events), count };
}

describe("AdminOverviewService", () => {
  it("counts accounts created in the last 7 days, not since today's midnight", async () => {
    const { service, count } = makeService();
    const now = new Date("2026-11-19T15:30:00.000Z");

    await service.getOverview(now);

    expect(count).toHaveBeenCalledWith({
      where: { createdAt: { gte: new Date("2026-11-12T15:30:00.000Z") } },
    });
  });

  it("reports the accounts connected right now", async () => {
    const { service } = makeService(5);

    await expect(service.getOverview()).resolves.toMatchObject({
      connectedNow: 5,
    });
  });
});
