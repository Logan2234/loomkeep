import { XpReason } from "@loomkeep/shared";
import type { ConfigService } from "@nestjs/config";
import { vi, type Mock } from "vitest";
import { parsePageQuery } from "../common/pagination.util";
import type { PrismaService } from "../prisma/prisma.service";
import { XpHistoryService } from "./xp-history.service";

function makeService(timezone = "Europe/Paris", enabled = "true") {
  const prisma = {
    user: { findUnique: vi.fn().mockResolvedValue({ timezone }) },
    xpEntry: { findMany: vi.fn().mockResolvedValue([]) },
    $queryRaw: vi.fn().mockResolvedValue([]),
  } as unknown as PrismaService;
  const config = {
    get: vi.fn((key: string) =>
      key === "GAMIFICATION_ENABLED" ? enabled : undefined,
    ),
  } as unknown as ConfigService;
  return { service: new XpHistoryService(prisma, config), prisma };
}

const page = (n = 1, limit = 10) =>
  parsePageQuery(String(n), String(limit), limit);

const entry = (over: Record<string, unknown>) => ({
  reason: XpReason.EPISODE_WATCHED,
  sourceType: "EpisodeWatch",
  amount: 10,
  revokedAt: null,
  title: "The Bear",
  href: "/app/media/series/136315",
  data: { seasonNumber: 3, episodeNumber: 1 },
  ...over,
});

describe("XpHistoryService.history", () => {
  it("keeps a day's lines in time order, most recent first, and sums them", async () => {
    const { service, prisma } = makeService();
    (prisma.$queryRaw as Mock).mockResolvedValue([{ day: "2026-10-05" }]);
    (prisma.xpEntry.findMany as Mock).mockResolvedValue([
      entry({ createdAt: new Date("2026-10-05T17:00:00Z") }),
      entry({
        reason: XpReason.MOVIE_WATCHED,
        amount: 50,
        title: "Anora",
        href: "/app/media/movie/1064213",
        data: {},
        createdAt: new Date("2026-10-05T20:00:00Z"),
      }),
      entry({
        createdAt: new Date("2026-10-05T17:40:00Z"),
        data: { seasonNumber: 3, episodeNumber: 2 },
      }),
    ]);

    const result = await service.history("user-1", page());

    expect(result.hasMore).toBe(false);
    const [day] = result.items;
    expect(day.day).toBe("2026-10-05");
    expect(day.net).toBe(70);
    expect(day.items.map((i) => [i.reason, i.amount])).toEqual([
      [XpReason.MOVIE_WATCHED, 50],
      [XpReason.EPISODE_WATCHED, 10],
      [XpReason.EPISODE_WATCHED, 10],
    ]);
    expect(day.items[1]).toMatchObject({
      revoked: false,
      title: "The Bear",
      seasonNumber: 3,
      episodeNumber: 2,
    });
  });

  it("shows a revoked gain twice: earned on its day, taken back on the day it was revoked", async () => {
    const { service, prisma } = makeService();
    (prisma.$queryRaw as Mock).mockResolvedValue([
      { day: "2026-10-05" },
      { day: "2026-10-04" },
    ]);
    (prisma.xpEntry.findMany as Mock).mockResolvedValue([
      entry({
        createdAt: new Date("2026-10-04T18:00:00Z"),
        revokedAt: new Date("2026-10-05T19:40:00Z"),
      }),
    ]);

    const [today, yesterday] = (await service.history("user-1", page())).items;

    expect(today.net).toBe(-10);
    expect(today.items).toEqual([
      expect.objectContaining({
        revoked: true,
        amount: -10,
        at: "2026-10-05T19:40:00.000Z",
        earnedAt: "2026-10-04T18:00:00.000Z",
        revokedAt: null,
        title: "The Bear",
        href: "/app/media/series/136315",
      }),
    ]);
    expect(yesterday.net).toBe(10);
    expect(yesterday.items[0]).toMatchObject({
      revoked: false,
      amount: 10,
      revokedAt: "2026-10-05T19:40:00.000Z",
    });
  });

  it("drops the link of a deleted list, which leads nowhere", async () => {
    const { service, prisma } = makeService();
    (prisma.$queryRaw as Mock).mockResolvedValue([{ day: "2026-10-05" }]);
    (prisma.xpEntry.findMany as Mock).mockResolvedValue([
      entry({
        reason: XpReason.LIST_CREATED,
        sourceType: "List",
        title: "Noël",
        href: "/app/lists/list-1",
        data: {},
        createdAt: new Date("2026-10-05T10:00:00Z"),
        revokedAt: new Date("2026-10-05T11:00:00Z"),
      }),
    ]);

    const [day] = (await service.history("user-1", page())).items;

    expect(day.items.map((i) => [i.title, i.href])).toEqual([
      ["Noël", null],
      ["Noël", null],
    ]);
  });

  it("links an achievement to its card and an import to the import history", async () => {
    const { service, prisma } = makeService();
    (prisma.$queryRaw as Mock).mockResolvedValue([{ day: "2026-10-05" }]);
    (prisma.xpEntry.findMany as Mock).mockResolvedValue([
      entry({
        reason: XpReason.ACHIEVEMENT_UNLOCKED,
        sourceType: "UserAchievement",
        title: null,
        href: null,
        data: { achievementKey: "marathon" },
        createdAt: new Date("2026-10-05T10:00:00Z"),
      }),
      entry({
        reason: XpReason.IMPORT_COMPLETED,
        sourceType: "DOMAIN",
        title: null,
        href: null,
        data: { domain: "MEDIA" },
        createdAt: new Date("2026-10-05T09:00:00Z"),
      }),
    ]);

    const [day] = (await service.history("user-1", page())).items;

    expect(day.items.map((i) => i.href)).toEqual([
      "/app/achievements?unlocked=marathon",
      "/app/settings/import/history",
    ]);
  });

  it("files a line under the viewer's own day, not the server's", async () => {
    // 23:30 UTC on the 4th is already the 5th in Paris.
    const { service, prisma } = makeService("Europe/Paris");
    (prisma.$queryRaw as Mock).mockResolvedValue([{ day: "2026-10-05" }]);
    (prisma.xpEntry.findMany as Mock).mockResolvedValue([
      entry({ createdAt: new Date("2026-10-04T23:30:00Z") }),
    ]);

    const [day] = (await service.history("user-1", page())).items;

    expect(day.net).toBe(10);
  });

  it("falls back to UTC for an invalid stored timezone instead of failing", async () => {
    const { service, prisma } = makeService("Not/AZone");

    await service.history("user-1", page());

    const [, timezone] = (prisma.$queryRaw as Mock).mock.calls[0];
    expect(timezone).toBe("UTC");
  });

  it("pages by day and reports whether older days remain", async () => {
    const { service, prisma } = makeService();
    (prisma.$queryRaw as Mock).mockResolvedValue([
      { day: "2026-10-05" },
      { day: "2026-10-04" },
      { day: "2026-10-03" },
    ]);

    const result = await service.history("user-1", page(1, 2));

    expect(result.items.map((d) => d.day)).toEqual([
      "2026-10-05",
      "2026-10-04",
    ]);
    expect(result.hasMore).toBe(true);
  });

  it("is empty when gamification is off", async () => {
    const { service, prisma } = makeService("UTC", "false");

    await expect(service.history("user-1", page())).resolves.toEqual({
      items: [],
      hasMore: false,
    });
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });
});
