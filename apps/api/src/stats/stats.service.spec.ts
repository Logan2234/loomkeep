import type {
  BookStatsDto,
  GameStatsDto,
  MusicStatsDto,
  SocialStatsDto,
  StatsOverviewDto,
  VideoStatsDto,
  VideoTemporalDto,
} from "@loomkeep/shared";
import { vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import type { ReviewService } from "../reviews/review.service";
import type { DomainGateService } from "../users/domain-gate.service";
import { StatsService } from "./stats.service";

// Only the redaction (premium gating) logic is under test here — the rest
// of StatsService is data aggregation exercised indirectly via its own
// util specs. Dependencies are never called by the private redact*
// methods, so dummy stand-ins are enough to construct the service.
function makeService(): StatsService {
  return new StatsService(
    {} as unknown as PrismaService,
    {} as unknown as ReviewService,
    {} as unknown as DomainGateService,
  );
}

describe("StatsService — premium redaction", () => {
  it("passes the overview through unchanged for a premium account", () => {
    const service = makeService();
    const dto: StatsOverviewDto = {
      domain: "ALL",
      breakdowns: [],
      total: 5,
      favorites: 1,
      completionRate: 0.4,
      abandonRate: 0,
      ratedCount: 1,
      ratingRate: 0.2,
      averageRating: 10,
      ratingDistribution: [{ rating: 10, count: 1 }],
      decades: [{ decade: 2020, count: 3 }],
      possession: {
        sufficientData: true,
        byStatus: [{ status: "OWNED", count: 2 }],
      },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((service as any).redactOverview(dto, true)).toEqual(dto);
  });

  it("zeroes the rating distribution and empties decades/possession for a non-premium account", () => {
    const service = makeService();
    const dto: StatsOverviewDto = {
      domain: "ALL",
      breakdowns: [],
      total: 5,
      favorites: 1,
      completionRate: 0.4,
      abandonRate: 0,
      ratedCount: 1,
      ratingRate: 0.2,
      averageRating: 10,
      ratingDistribution: [{ rating: 10, count: 1 }],
      decades: [{ decade: 2020, count: 3 }],
      possession: {
        sufficientData: true,
        byStatus: [{ status: "OWNED", count: 2 }],
      },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const redacted = (service as any).redactOverview(dto, false);

    expect(redacted.total).toBe(5);
    expect(redacted.averageRating).toBe(10);
    expect(redacted.ratingDistribution).toEqual([{ rating: 10, count: 0 }]);
    expect(redacted.decades).toEqual([]);
    expect(redacted.possession).toEqual({
      sufficientData: false,
      renseignedRatio: 0,
    });
  });

  it("strips the advanced video fields for a non-premium account, keeping the counting ones", () => {
    const service = makeService();
    const dto: VideoStatsDto = {
      totalMinutes: 500,
      episodesWatched: 10,
      uniqueEpisodesWatched: 8,
      seasonsCompleted: 2,
      typeSplit: [],
      avgEpisodeRuntimeMin: 24,
      longestFilm: { title: "Inception", minutes: 148, href: "/media/movie/1" },
      shortestFilm: { title: "Short", minutes: 60, href: "/media/movie/2" },
      genres: [{ genre: "Action", count: 5 }],
      pausedCount: 2,
      ghostCount: 1,
      longestBingeCount: 4,
      moviesRewatchedCount: 3,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const redacted = (service as any).redactVideo(dto, false);

    expect(redacted.totalMinutes).toBe(500);
    expect(redacted.episodesWatched).toBe(10);
    expect(redacted.avgEpisodeRuntimeMin).toBe(24);
    expect(redacted.longestFilm).toBeNull();
    expect(redacted.shortestFilm).toBeNull();
    expect(redacted.genres).toEqual([]);
    expect(redacted.pausedCount).toBe(0);
    expect(redacted.ghostCount).toBe(0);
    expect(redacted.longestBingeCount).toBe(0);
    expect(redacted.moviesRewatchedCount).toBe(0);
  });

  it("strips ranked/grouped fields from game stats for a non-premium account", () => {
    const service = makeService();
    const dto: GameStatsDto = {
      totalPlaytimeMinutes: 100,
      avgPlaytimePerCompletedMinutes: 50,
      neverLaunchedCount: 1,
      replaysCount: 2,
      topGamesByPlaytime: [{ title: "Hades", minutes: 60, href: "/games/1" }],
      topPlatforms: [{ label: "PC", count: 1 }],
      topGenres: [{ label: "Action", count: 1 }],
      avgRatingByPlatform: [{ label: "PC", averageRating: 8, count: 1 }],
      avgRatingByGenre: [{ label: "Action", averageRating: 8, count: 1 }],
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const redacted = (service as any).redactGame(dto, false);

    expect(redacted.totalPlaytimeMinutes).toBe(100);
    expect(redacted.replaysCount).toBe(2);
    expect(redacted.topGamesByPlaytime).toEqual([]);
    expect(redacted.topPlatforms).toEqual([]);
    expect(redacted.topGenres).toEqual([]);
    expect(redacted.avgRatingByPlatform).toEqual([]);
    expect(redacted.avgRatingByGenre).toEqual([]);
  });

  it("strips top authors and extremes from book stats for a non-premium account", () => {
    const service = makeService();
    const dto: BookStatsDto = {
      pagesRead: 300,
      avgPagesPerRead: 150,
      longestBook: { title: "War and Peace", pages: 1200, href: "/books/1" },
      shortestBook: { title: "Novella", pages: 80, href: "/books/2" },
      topAuthorsByPages: [{ author: "Tolstoy", pages: 1200 }],
      distinctAuthorsCount: 2,
      rereadsCount: 1,
      stagnantInProgressCount: 0,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const redacted = (service as any).redactBook(dto, false);

    expect(redacted.pagesRead).toBe(300);
    expect(redacted.rereadsCount).toBe(1);
    expect(redacted.longestBook).toBeNull();
    expect(redacted.shortestBook).toBeNull();
    expect(redacted.topAuthorsByPages).toEqual([]);
    expect(redacted.distinctAuthorsCount).toBe(0);
  });

  it("strips top artists and release split from music stats for a non-premium account", () => {
    const service = makeService();
    const dto: MusicStatsDto = {
      listenDurationMin: 200,
      totalTracks: 30,
      distinctArtistsCount: 5,
      topArtists: [{ label: "Artist", count: 3 }],
      releaseTypeSplit: [{ label: "Album", count: 2 }],
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const redacted = (service as any).redactMusic(dto, false);

    expect(redacted.listenDurationMin).toBe(200);
    expect(redacted.totalTracks).toBe(30);
    expect(redacted.topArtists).toEqual([]);
    expect(redacted.releaseTypeSplit).toEqual([]);
  });

  it("empties every field of the video temporal section for a non-premium account", () => {
    const service = makeService();
    const dto: VideoTemporalDto = {
      heatmap: [{ date: "2026-01-01", count: 2 }],
      byWeekday: [{ weekday: 0, count: 3 }],
      byHour: [{ hour: 20, count: 4 }],
      monthlyMinutes: [{ month: "2026-01", minutes: 100 }],
      yearlyMinutes: [{ year: 2026, minutes: 1000 }],
      mostActiveYear: 2026,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const redacted = (service as any).redactVideoTemporal(dto, false);

    expect(redacted.heatmap).toEqual([]);
    expect(redacted.byWeekday).toEqual([{ weekday: 0, count: 0 }]);
    expect(redacted.byHour).toEqual([{ hour: 20, count: 0 }]);
    expect(redacted.monthlyMinutes).toEqual([]);
    expect(redacted.yearlyMinutes).toEqual([]);
    expect(redacted.mostActiveYear).toBeNull();
  });

  it("zeroes the entire social section for a non-premium account", () => {
    const service = makeService();
    const dto: SocialStatsDto = {
      reviewsWritten: 3,
      avgReviewLength: 42,
      ratingVsCommunity: {
        sufficientData: true,
        yourAverage: 8,
        communityAverage: 7,
        sampleSize: 12,
      },
      commentsWritten: 1,
      rootCommentsCount: 1,
      replyCommentsCount: 0,
      spoilerCommentRatio: 1,
      reviewRevisionsCount: 0,
      helpfulVotesReceived: 1,
      mostVotedReviewVotes: 1,
      reactionsGiven: 1,
      reactionsReceived: 1,
      listsWritten: 1,
      listsPublicCount: 1,
      newFollowersByMonth: [{ month: "2026-01", count: 1 }],
      followerReciprocityRate: 0.5,
      socialActivityByMonth: [{ month: "2026-01", count: 1 }],
      contributionStreakDays: 2,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const redacted = (service as any).redactSocial(dto, false);

    expect(redacted.reviewsWritten).toBe(0);
    expect(redacted.ratingVsCommunity).toEqual({
      sufficientData: false,
      sampleSize: 0,
    });
    expect(redacted.newFollowersByMonth).toEqual([]);
    expect(redacted.contributionStreakDays).toBe(0);
  });
});

// --- Query shape: what these assert is that the filtering happens in
//     Postgres. The aggregates themselves are covered by the util specs. ---

function makeServiceWith(prisma: unknown): StatsService {
  return new StatsService(
    prisma as PrismaService,
    {} as unknown as ReviewService,
    {} as unknown as DomainGateService,
  );
}

describe("StatsService.getVideoTemporal", () => {
  it("excludes specials and unwatched rows in the query, not in memory", async () => {
    // EpisodeWatch is the one table that grows without bound here: loading
    // every row the account ever recorded and then filtering it is what made
    // this the heaviest page in the app.
    const findMany = vi.fn().mockResolvedValue([]);
    const service = makeServiceWith({ episodeWatch: { findMany } });

    await service.getVideoTemporal("user-1", "ALL", true);

    expect(findMany.mock.calls[0][0].where).toEqual({
      userId: "user-1",
      watchedAt: { not: null },
      episode: { season: { number: { not: 0 } } },
    });
  });
});

describe("StatsService in-progress staleness", () => {
  const SERIES = {
    mediaItem: {
      id: "m1",
      title: "Série",
      posterUrl: null,
      type: "SERIES",
      canonicalSource: "TMDB",
      externalIds: [],
    },
  };

  function make(entries: unknown[], watches: unknown[] = []) {
    const prisma = {
      libraryEntry: { findMany: vi.fn().mockResolvedValue(entries) },
      episodeWatch: { findMany: vi.fn().mockResolvedValue(watches) },
    };
    return { service: makeServiceWith(prisma), prisma };
  }

  function run(service: StatsService) {
    return (
      service as unknown as {
        fetchInProgressStaleness: (id: string) => Promise<unknown[]>;
      }
    ).fetchInProgressStaleness("user-1");
  }

  it("scopes the watch history to the series still in progress", async () => {
    // It used to read every EpisodeWatch of the account to derive one date
    // per in-progress series.
    const { service, prisma } = make([SERIES]);

    await run(service);

    expect(prisma.episodeWatch.findMany.mock.calls[0][0].where).toEqual({
      userId: "user-1",
      watchedAt: { not: null },
      episode: { season: { mediaItemId: { in: ["m1"] } } },
    });
  });

  it("does not query the watch history at all with nothing in progress", async () => {
    const { service, prisma } = make([]);

    await run(service);

    expect(prisma.episodeWatch.findMany).not.toHaveBeenCalled();
  });

  it("ignores movies, which have no episodes to be stale on", async () => {
    const movie = {
      mediaItem: { ...SERIES.mediaItem, id: "m2", type: "MOVIE" },
    };
    const { service, prisma } = make([SERIES, movie]);

    await run(service);

    expect(
      prisma.episodeWatch.findMany.mock.calls[0][0].where.episode.season
        .mediaItemId.in,
    ).toEqual(["m1"]);
  });
});

describe("StatsService.getSocialStats", () => {
  it("totals the list counts the database grouped, rather than loading them", async () => {
    const groupBy = vi.fn().mockResolvedValue([
      { visibility: "PUBLIC", _count: { _all: 3 } },
      { visibility: "PRIVATE", _count: { _all: 2 } },
      { visibility: "UNLISTED", _count: { _all: 1 } },
    ]);
    const service = makeServiceWith({
      review: { findMany: vi.fn().mockResolvedValue([]) },
      comment: { findMany: vi.fn().mockResolvedValue([]) },
      commentReaction: { count: vi.fn().mockResolvedValue(0) },
      list: { groupBy },
      follow: { findMany: vi.fn().mockResolvedValue([]) },
    });

    const dto = await service.getSocialStats("user-1", true);

    expect(groupBy).toHaveBeenCalledWith({
      by: ["visibility"],
      where: { userId: "user-1" },
      _count: { _all: true },
    });
    expect(dto.listsWritten).toBe(6);
    expect(dto.listsPublicCount).toBe(3);
  });
});
