import type { ConfigService } from "@nestjs/config";
import { vi } from "vitest";
import type { EntitlementService } from "../../entitlements/entitlement.service";
import type { LibraryService } from "../../library/library.service";
import type { PrismaService } from "../../prisma/prisma.service";
import { CalendarFeedService } from "./calendar-feed.service";

function makeService(
  user: { id: string; locale?: string; calendarToken?: string | null } | null,
  hasPremium: boolean,
) {
  const prisma = {
    user: {
      findUnique: vi.fn().mockResolvedValue(user),
      findUniqueOrThrow: vi.fn().mockResolvedValue(user),
      update: vi.fn().mockResolvedValue({ calendarToken: "fresh-token" }),
    },
    episode: { findMany: vi.fn().mockResolvedValue([]) },
  } as unknown as PrismaService;
  const entitlements = {
    isEffectivelyPremium: vi.fn().mockResolvedValue(hasPremium),
  } as unknown as EntitlementService;
  const config = {
    get: vi.fn().mockReturnValue("https://loomkeep.app,http://localhost:5173"),
  } as unknown as ConfigService;
  const library = {
    getCalendar: vi.fn().mockResolvedValue([]),
  } as unknown as LibraryService;

  return {
    service: new CalendarFeedService(prisma, entitlements, library, config),
    prisma,
  };
}

describe("CalendarFeedService.getCalendarIcs", () => {
  it("returns the feed for a premium user with a valid token", async () => {
    const { service } = makeService({ id: "user-1" }, true);
    await expect(service.getCalendarIcs("tok")).resolves.not.toBeNull();
  });

  it("returns null for a non-premium user, even with a valid token", async () => {
    const { service } = makeService({ id: "user-1" }, false);
    await expect(service.getCalendarIcs("tok")).resolves.toBeNull();
  });

  it("returns null when the token matches no account", async () => {
    const { service } = makeService(null, true);
    await expect(service.getCalendarIcs("tok")).resolves.toBeNull();
  });
});

describe("CalendarFeedService tokens", () => {
  it("keeps an existing token rather than revoking the shared link", async () => {
    const { service, prisma } = makeService(
      { id: "user-1", calendarToken: "shared-token" },
      true,
    );

    await expect(service.getToken("user-1")).resolves.toEqual({
      token: "shared-token",
    });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("issues a token on first use", async () => {
    const { service } = makeService(
      { id: "user-1", calendarToken: null },
      true,
    );

    await expect(service.getToken("user-1")).resolves.toEqual({
      token: "fresh-token",
    });
  });

  it("refuses a non-premium account", async () => {
    const { service } = makeService({ id: "user-1" }, false);

    await expect(service.regenerateToken("user-1")).rejects.toMatchObject({
      status: 403,
    });
  });
});

describe("CalendarFeedService.getReleasesFeed", () => {
  const now = new Date("2026-09-24T12:00:00Z");

  it("lists the last month's aired episodes of the followed shows, newest first", async () => {
    const { service, prisma } = makeService(
      { id: "user-1", locale: "fr" },
      true,
    );

    await service.getReleasesFeed("tok", now);

    expect(prisma.episode.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          airDate: { gte: new Date("2026-08-25T12:00:00Z"), lte: now },
          season: {
            mediaItem: {
              entries: {
                some: { userId: "user-1", status: { not: "DROPPED" } },
              },
            },
          },
        },
        orderBy: { airDate: "desc" },
      }),
    );
  });

  it("links each episode to its show's page in the web app", async () => {
    const { service, prisma } = makeService(
      { id: "user-1", locale: "en" },
      true,
    );
    (prisma.episode.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: "ep-1",
        number: 5,
        title: "Cold Harbor",
        airDate: new Date("2026-09-20T00:00:00Z"),
        season: {
          number: 2,
          mediaItem: {
            title: "Severance",
            type: "SERIES",
            canonicalSource: "TMDB",
            externalIds: [{ source: "TMDB", externalId: "95396" }],
          },
        },
      },
    ]);

    const feed = await service.getReleasesFeed("tok", now);

    expect(feed?.title).toBe("Loomkeep · New episodes");
    expect(feed?.entries).toEqual([
      {
        id: "urn:loomkeep:episode:ep-1",
        title: "Severance — S02E05 · Cold Harbor",
        link: "https://loomkeep.app/app/media/series/95396",
        airDate: new Date("2026-09-20T00:00:00Z"),
      },
    ]);
  });

  it("returns null for a non-premium account, like the calendar", async () => {
    const { service } = makeService({ id: "user-1", locale: "fr" }, false);
    await expect(service.getReleasesFeed("tok", now)).resolves.toBeNull();
  });
});
