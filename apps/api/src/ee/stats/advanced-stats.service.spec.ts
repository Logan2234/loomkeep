import { vi } from "vitest";
import type { PrismaService } from "../../prisma/prisma.service";
import type { ReviewService } from "../../reviews/review.service";
import type { StatsService } from "../../stats/stats.service";
import type { LicenseService } from "../licensing/license.service";
import { AdvancedStatsService } from "./advanced-stats.service";

function makeService(prisma: unknown = {}, licensed = true) {
  const stats = {
    setAdvancedStatsSource: vi.fn(),
    fetchInProgressStaleness: vi.fn().mockResolvedValue([]),
  } as unknown as StatsService;
  const license = {
    isActive: vi.fn().mockReturnValue(licensed),
  } as unknown as LicenseService;

  return {
    service: new AdvancedStatsService(
      prisma as PrismaService,
      {
        getRatings: vi.fn().mockResolvedValue(new Map()),
      } as unknown as ReviewService,
      stats,
      license,
    ),
    stats,
  };
}

describe("AdvancedStatsService", () => {
  it("hands itself to the core StatsService at startup", () => {
    const { service, stats } = makeService();
    expect(stats.setAdvancedStatsSource).toHaveBeenCalledWith(service);
  });

  it("computes nothing on an unlicensed instance", async () => {
    const { service } = makeService({}, false);

    expect(service.music({ entries: [] })).toBeNull();
    await expect(service.social("user-1")).resolves.toBeNull();
  });

  it("ranks artists and release types, most frequent first", () => {
    const { service } = makeService();

    expect(
      service.music({
        entries: [
          { artists: ["Air", "Beck"], albumType: "Album" },
          { artists: ["Air"], albumType: null },
        ],
      }),
    ).toEqual({
      topArtists: [
        { label: "Air", count: 2 },
        { label: "Beck", count: 1 },
      ],
      releaseTypeSplit: [
        { label: "Album", count: 1 },
        { label: "Autre", count: 1 },
      ],
    });
  });

  it("weighs a movie's genres by how many times it was watched", async () => {
    const { service } = makeService({
      movieReplay: { count: vi.fn().mockResolvedValue(1) },
    });

    const video = await service.video("user-1", {
      episodeWatches: [{ watchedAt: null, genres: ["Drama"] }],
      completedMovies: [
        {
          title: "Arrival",
          runtimeMin: 116,
          genres: ["Drama"],
          href: "/media/movie/1",
          viewings: 2,
        },
      ],
    });

    expect(video?.genres).toEqual([{ genre: "Drama", count: 3 }]);
    expect(video?.longestFilm).toEqual({
      title: "Arrival",
      minutes: 116,
      href: "/media/movie/1",
    });
  });

  // These verify PostgreSQL filtering; the util specs cover the aggregates.

  it("excludes specials and unwatched rows in the temporal query, not in memory", async () => {
    // EpisodeWatch is the one table that grows without bound here: loading
    // every row the account ever recorded and then filtering it is what made
    // this the heaviest page in the app.
    const findMany = vi.fn().mockResolvedValue([]);
    const { service } = makeService({ episodeWatch: { findMany } });

    await service.videoTemporal("user-1", "ALL");

    expect(findMany.mock.calls[0][0].where).toEqual({
      userId: "user-1",
      watchedAt: { not: null },
      episode: { season: { number: { not: 0 } } },
    });
  });

  it("totals the list counts the database grouped, rather than loading them", async () => {
    const groupBy = vi.fn().mockResolvedValue([
      { visibility: "PUBLIC", _count: { _all: 3 } },
      { visibility: "PRIVATE", _count: { _all: 2 } },
      { visibility: "UNLISTED", _count: { _all: 1 } },
    ]);
    const { service } = makeService({
      review: { findMany: vi.fn().mockResolvedValue([]) },
      comment: { findMany: vi.fn().mockResolvedValue([]) },
      commentReaction: { count: vi.fn().mockResolvedValue(0) },
      list: { groupBy },
      follow: { findMany: vi.fn().mockResolvedValue([]) },
    });

    const dto = await service.social("user-1");

    expect(groupBy).toHaveBeenCalledWith({
      by: ["visibility"],
      where: { userId: "user-1" },
      _count: { _all: true },
    });
    expect(dto?.listsWritten).toBe(6);
    expect(dto?.listsPublicCount).toBe(3);
  });
});
