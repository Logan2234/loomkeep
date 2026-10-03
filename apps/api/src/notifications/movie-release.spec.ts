import { vi } from "vitest";
import { NotificationService } from "./notification.service";

describe("movie release reminders", () => {
  afterEach(() => vi.useRealTimers());
  it("waits for local cinema, uses the selected region, and deduplicates later scans", async () => {
    vi.useFakeTimers().setSystemTime(new Date("2026-10-03T12:00:00Z"));
    const dates = [
      { country: "US", date: "2026-10-02", type: 3 },
      { country: "FR", date: "2026-10-02", type: 4 },
      { country: "FR", date: "2026-10-04", type: 3 },
    ];
    const rows = [
      {
        userId: "u1",
        mediaItemId: "m1",
        movieReleaseReminderAt: new Date("2026-10-01"),
        movieReleaseRegion: "FR",
        user: { watchRegion: null, locale: "fr" },
        mediaItem: {
          id: "m1",
          type: "MOVIE",
          status: "Released",
          title: "Future movie",
          canonicalSource: "TMDB",
          externalIds: [{ source: "TMDB", externalId: "1" }],
          movieReleaseDates: dates,
        },
      },
    ];
    const seen = new Set<string>();
    const createMany = vi.fn(
      async ({ data }: { data: { dedupeKey: string }[] }) => {
        const fresh = data.filter((r) => !seen.has(r.dedupeKey));
        fresh.forEach((r) => seen.add(r.dedupeKey));
        return { count: fresh.length };
      },
    );
    const prisma = {
      libraryEntry: { findMany: vi.fn().mockResolvedValue(rows) },
      episode: { findMany: vi.fn().mockResolvedValue([]) },
      notification: { createMany },
    };
    const service = new NotificationService(
      prisma as never,
      { record: (_key: string, fn: () => Promise<unknown>) => fn() } as never,
      {} as never,
      {} as never,
    );
    expect(await service.scanAll()).toBe(0);
    vi.setSystemTime(new Date("2026-10-04T12:00:00Z"));
    expect(await service.scanAll()).toBe(1);
    expect(createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skipDuplicates: true,
        data: [
          expect.objectContaining({
            type: "NEW_MOVIE",
            url: "/app/media/movie/1",
            data: expect.objectContaining({
              region: "FR",
              releaseType: "cinema",
            }),
          }),
        ],
      }),
    );
    expect(await service.scanAll()).toBe(0);
  });
  it("keeps a reminder pending when its local release is unknown", async () => {
    const createMany = vi.fn();
    const prisma = {
      libraryEntry: {
        findMany: vi.fn().mockResolvedValue([
          {
            userId: "u1",
            movieReleaseReminderAt: new Date(),
            user: { watchRegion: "FR" },
            mediaItem: {
              type: "MOVIE",
              status: "Planned",
              movieReleaseDates: [
                { country: "US", date: "2099-01-01", type: 3 },
              ],
            },
          },
        ]),
      },
      episode: { findMany: vi.fn().mockResolvedValue([]) },
      notification: { createMany },
    };
    const service = new NotificationService(
      prisma as never,
      { record: (_key: string, fn: () => Promise<unknown>) => fn() } as never,
      {} as never,
      {} as never,
    );
    expect(await service.scanAll()).toBe(0);
    expect(createMany).not.toHaveBeenCalled();
  });
});
