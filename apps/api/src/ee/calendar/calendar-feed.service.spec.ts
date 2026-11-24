import type { ConfigService } from "@nestjs/config";
import { vi } from "vitest";
import type { TmdbProvider } from "../../catalog/providers/tmdb.provider";
import type { EntitlementService } from "../../entitlements/entitlement.service";
import type { CalendarService } from "../../library/calendar.service";
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
    mediaEntry: { findMany: vi.fn().mockResolvedValue([]) },
    gameEntry: { findMany: vi.fn().mockResolvedValue([]) },
  } as unknown as PrismaService;
  const entitlements = {
    isEffectivelyPremium: vi.fn().mockResolvedValue(hasPremium),
  } as unknown as EntitlementService;
  const config = {
    get: vi.fn().mockReturnValue("https://loomkeep.app,http://localhost:5173"),
  } as unknown as ConfigService;
  const calendar = {
    getCalendar: vi.fn().mockResolvedValue([]),
  } as unknown as CalendarService;
  const tmdb = {
    listPremieres: vi.fn().mockResolvedValue([
      {
        sourceId: "171802",
        title: "Blade Runner 2099",
        originalTitle: null,
        firstAirDate: "2026-11-25",
        networkId: 1024,
        networkName: "Prime Video",
        originCountries: ["US"],
        overview: null,
        posterUrl: "https://image.tmdb.org/t/p/w500/p.jpg",
        backdropUrl: null,
        popularity: 10,
      },
    ]),
  };

  return {
    service: new CalendarFeedService(
      prisma,
      entitlements,
      calendar,
      config,
      tmdb as unknown as TmdbProvider,
    ),
    prisma,
    tmdb,
  };
}

describe("CalendarFeedService.getPremieresIcs", () => {
  it("lists the premieres in the subscriber's language, linking to this instance", async () => {
    const { service, tmdb } = makeService({ id: "user-1", locale: "fr" }, true);

    const ics = await service.getPremieresIcs("tok");

    expect(tmdb.listPremieres).toHaveBeenCalledWith("fr");
    expect(ics).toContain("X-WR-CALNAME:Loomkeep · Premières");
    expect(ics).toContain("URL:https://loomkeep.app/app/media/series/171802");
  });

  it("returns null for a non-premium user, even with a valid token", async () => {
    const { service, tmdb } = makeService({ id: "user-1" }, false);

    await expect(service.getPremieresIcs("tok")).resolves.toBeNull();
    expect(tmdb.listPremieres).not.toHaveBeenCalled();
  });
});

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
    const { service, prisma } = makeService(
      { id: "user-1", calendarToken: null },
      true,
    );

    const { token } = await service.getToken("user-1");
    expect(token).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { calendarToken: token },
      select: { calendarToken: true },
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

    expect(feed?.title).toBe("Loomkeep · New releases");
    expect(feed?.entries).toEqual([
      {
        id: "urn:loomkeep:episode:ep-1",
        title: "Severance — S02E05 · Cold Harbor",
        link: "https://loomkeep.app/app/media/series/95396",
        airDate: new Date("2026-09-20T00:00:00Z"),
      },
    ]);
  });

  it("adds the movies and games that came out, newest first", async () => {
    const { service, prisma } = makeService(
      { id: "user-1", locale: "fr", watchRegion: "FR" } as never,
      true,
    );
    (prisma.episode.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: "ep-1",
        number: 5,
        title: null,
        airDate: new Date("2026-09-10T00:00:00Z"),
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
    (prisma.mediaEntry.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        movieReleaseRegion: null,
        mediaItem: {
          id: "m1",
          title: "Dune",
          status: "Released",
          canonicalSource: "TMDB",
          externalIds: [{ source: "TMDB", externalId: "438631" }],
          movieReleaseDates: [{ country: "FR", date: "2026-09-15", type: 3 }],
        },
      },
      {
        movieReleaseRegion: null,
        mediaItem: {
          id: "m2",
          title: "Avengers: Doomsday",
          status: "Post Production",
          canonicalSource: "TMDB",
          externalIds: [{ source: "TMDB", externalId: "1003596" }],
          movieReleaseDates: [{ country: "FR", date: "2026-12-16", type: 3 }],
        },
      },
    ]);
    (prisma.gameEntry.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        gameItem: {
          id: "g1",
          title: "Hollow Knight: Silksong",
          canonicalSource: "IGDB",
          externalIds: [{ source: "IGDB", externalId: "136224" }],
          releaseDate: new Date("2026-09-20T00:00:00Z"),
          releaseDatePrecision: "DAY",
        },
      },
    ]);

    const feed = await service.getReleasesFeed("tok", now);

    expect(feed?.title).toBe("Loomkeep · Sorties");
    expect(feed?.entries).toEqual([
      {
        id: "urn:loomkeep:game:g1",
        title: "Hollow Knight: Silksong — Sortie du jeu",
        link: "https://loomkeep.app/app/games/136224",
        airDate: new Date("2026-09-20T00:00:00Z"),
      },
      {
        id: "urn:loomkeep:movie:m1:FR",
        title: "Dune — Sortie au cinéma · FR",
        link: "https://loomkeep.app/app/media/movie/438631",
        airDate: new Date("2026-09-15T00:00:00Z"),
      },
      expect.objectContaining({ id: "urn:loomkeep:episode:ep-1" }),
    ]);
  });

  it("returns null for a non-premium account, like the calendar", async () => {
    const { service } = makeService({ id: "user-1", locale: "fr" }, false);
    await expect(service.getReleasesFeed("tok", now)).resolves.toBeNull();
  });
});
