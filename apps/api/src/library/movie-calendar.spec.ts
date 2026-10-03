import { vi } from "vitest";
import { LibraryService } from "./library.service";

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
      user: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ watchRegion: "FR" }),
      },
    };
    const service = new LibraryService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
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
});
