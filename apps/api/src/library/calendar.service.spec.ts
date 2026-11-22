import { vi } from "vitest";
import { CalendarService } from "./calendar.service";

describe("local movie release calendar", () => {
  afterEach(() => vi.useRealTimers());
  it("lists local releases independently of reminders and follows postponed dates", async () => {
    vi.useFakeTimers().setSystemTime(new Date("2026-10-03T12:00:00Z"));
    const movie = {
      id: "m1",
      type: "MOVIE",
      status: "Post Production",
      title: "Future movie",
      canonicalSource: "TMDB",
      posterUrl: null,
      externalIds: [{ source: "TMDB", externalId: "1" }],
      movieReleaseDates: [
        { country: "US", date: "2026-10-04", type: 3 },
        { country: "FR", date: "2026-10-07", type: 3 },
      ],
    };
    const row = {
      id: "e1",
      mediaItem: movie,
      movieReleaseReminderAt: null,
      movieReleaseRegion: null,
    };
    const prisma = {
      episode: { findMany: vi.fn().mockResolvedValue([]) },
      libraryEntry: { findMany: vi.fn().mockResolvedValue([row]) },
      gameEntry: { findMany: vi.fn().mockResolvedValue([]) },
      user: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ watchRegion: "FR" }),
      },
    };
    const service = new CalendarService(prisma as never);
    expect(await service.getCalendar("u1")).toEqual([
      expect.objectContaining({
        entryId: "e1",
        seasonNumber: null,
        episodeNumber: null,
        airDate: "2026-10-07T00:00:00.000Z",
        releaseRegion: "FR",
        releaseType: "cinema",
        episodeAlertsMuted: true,
      }),
    ]);
    movie.movieReleaseDates[1].date = "2026-10-14";
    expect((await service.getCalendar("u1"))[0].airDate).toBe(
      "2026-10-14T00:00:00.000Z",
    );
    movie.movieReleaseDates.pop();
    expect(await service.getCalendar("u1")).toEqual([]);
  });

  it("lists a game dated to a month on its 1st, beside the episodes", async () => {
    const game = {
      id: "e2",
      releaseReminderAt: new Date("2026-09-01T00:00:00Z"),
      gameItem: {
        id: "g1",
        title: "Kingdom Hearts IV",
        coverUrl: null,
        canonicalSource: "IGDB",
        externalIds: [{ source: "IGDB", externalId: "113112" }],
        releaseDate: new Date("2026-11-01T00:00:00Z"),
        releaseDatePrecision: "MONTH",
      },
    };
    const gameEntryFindMany = vi.fn().mockResolvedValue([game]);
    const prisma = {
      episode: { findMany: vi.fn().mockResolvedValue([]) },
      libraryEntry: { findMany: vi.fn().mockResolvedValue([]) },
      gameEntry: { findMany: gameEntryFindMany },
      user: {
        findUniqueOrThrow: vi
          .fn()
          .mockResolvedValue({ watchRegion: null, timezone: "UTC" }),
      },
    };
    const service = new CalendarService(prisma as never);

    expect(await service.getCalendar("u1")).toEqual([
      expect.objectContaining({
        mediaItem: null,
        game: expect.objectContaining({
          title: "Kingdom Hearts IV",
          sourceId: "113112",
        }),
        entryId: "e2",
        episodeAlertsMuted: false,
        releasePrecision: "MONTH",
        airDate: "2026-11-01T00:00:00.000Z",
      }),
    ]);
    // A vaguer date has no day to sit on; a disabled domain shows nothing.
    expect(gameEntryFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          user: { enabledDomains: { has: "GAMES" } },
          gameItem: expect.objectContaining({
            releaseDatePrecision: { in: ["DAY", "MONTH"] },
          }),
        }),
      }),
    );
  });

  // Six months of episodes from the user's own midnight, not 60 episodes
  // from the server's: a few daily shows used to hide every later episode
  // (audit 2026-11-14, BUG-05).
  it("lists six months of episodes from the start of the user's own day", async () => {
    vi.useFakeTimers().setSystemTime(new Date("2026-11-14T23:30:00Z"));
    const episodeFindMany = vi.fn().mockResolvedValue([]);
    const prisma = {
      episode: { findMany: episodeFindMany },
      libraryEntry: { findMany: vi.fn().mockResolvedValue([]) },
      gameEntry: { findMany: vi.fn().mockResolvedValue([]) },
      user: {
        findUniqueOrThrow: vi
          .fn()
          .mockResolvedValue({ watchRegion: null, timezone: "Europe/Paris" }),
      },
    };

    await new CalendarService(prisma as never).getCalendar("u1");

    // 00:30 on the 15th in Paris: the day began at 23:00 UTC on the 14th.
    const [[query]] = episodeFindMany.mock.calls;
    expect(query.where.airDate).toEqual({
      gte: new Date("2026-11-14T23:00:00Z"),
      lt: new Date("2027-05-16T23:00:00Z"),
    });
    expect(query.take).toBe(500);
  });

  it("flags the episode that ends its season", async () => {
    vi.useFakeTimers().setSystemTime(new Date("2026-11-20T10:00:00Z"));
    const mediaItem = {
      id: "m1",
      title: "Andor",
      type: "SERIES",
      canonicalSource: "TMDB",
      externalIds: [{ source: "TMDB", externalId: "83867" }],
      entries: [{ id: "e1", episodeAlertsMuted: false }],
    };
    const episode = (number: number, episodeType: string | null) => ({
      number,
      title: null,
      episodeType,
      airDate: new Date(`2026-11-2${number}T20:00:00Z`),
      season: { number: 2, mediaItemId: "m1", mediaItem },
    });
    const prisma = {
      episode: {
        findMany: vi
          .fn()
          .mockResolvedValue([episode(1, "standard"), episode(2, "finale")]),
      },
      $queryRaw: vi.fn().mockResolvedValue([]),
      libraryEntry: { findMany: vi.fn().mockResolvedValue([]) },
      gameEntry: { findMany: vi.fn().mockResolvedValue([]) },
      user: {
        findUniqueOrThrow: vi
          .fn()
          .mockResolvedValue({ watchRegion: null, timezone: "UTC" }),
      },
    };

    const [standard, finale] = await new CalendarService(
      prisma as never,
    ).getCalendar("u1");

    expect(standard.seasonFinale).toBeUndefined();
    expect(finale).toMatchObject({ episodeNumber: 2, seasonFinale: true });
    vi.useRealTimers();
  });
});
