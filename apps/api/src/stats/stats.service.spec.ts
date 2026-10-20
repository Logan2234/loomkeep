import { vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import type { ReviewService } from "../reviews/review.service";
import type { DomainGateService } from "../users/domain-gate.service";
import type { AdvancedStatsSource } from "./advanced-stats.source";
import { StatsService } from "./stats.service";

function makeServiceWith(prisma: unknown): StatsService {
  return new StatsService(
    prisma as PrismaService,
    {} as unknown as ReviewService,
    {} as unknown as DomainGateService,
  );
}

const MUSIC_ENTRY = {
  status: "LISTENED",
  musicItem: {
    artists: ["Air"],
    trackCount: 10,
    durationMin: 40,
    albumType: "Album",
  },
};

function musicService() {
  return makeServiceWith({
    musicEntry: { findMany: vi.fn().mockResolvedValue([MUSIC_ENTRY]) },
  });
}

function fakeSource(overrides: Partial<AdvancedStatsSource>) {
  return overrides as AdvancedStatsSource;
}

// The advanced fields are computed by ee/stats (LICENSE-EE); the core only
// decides whether to ask for them and what to serve when it can't.
describe("StatsService — advanced statistics", () => {
  it("serves the free fields and empty advanced ones without ee/", async () => {
    const dto = await musicService().getMusicStats("user-1", true);

    expect(dto).toMatchObject({
      listenDurationMin: 40,
      totalTracks: 10,
      distinctArtistsCount: 1,
      topArtists: [],
      releaseTypeSplit: [],
    });
  });

  it("merges in what ee/ computes for a premium account", async () => {
    const service = musicService();
    const topArtists = [{ label: "Air", count: 1 }];
    service.setAdvancedStatsSource(
      fakeSource({ music: () => ({ topArtists, releaseTypeSplit: [] }) }),
    );

    const dto = await service.getMusicStats("user-1", true);

    expect(dto.topArtists).toEqual(topArtists);
    expect(dto.listenDurationMin).toBe(40);
  });

  it("never asks ee/ for a free account", async () => {
    const service = musicService();
    const music = vi.fn();
    service.setAdvancedStatsSource(fakeSource({ music }));

    const dto = await service.getMusicStats("user-1", false);

    expect(music).not.toHaveBeenCalled();
    expect(dto.topArtists).toEqual([]);
  });

  it("falls back to the empty values when the instance isn't licensed", async () => {
    const service = musicService();
    service.setAdvancedStatsSource(fakeSource({ music: () => null }));

    const dto = await service.getMusicStats("user-1", true);

    expect(dto.releaseTypeSplit).toEqual([]);
  });

  it("serves the locked shape of the whole temporal section without ee/", async () => {
    const dto = await makeServiceWith({}).getVideoTemporal(
      "user-1",
      "ALL",
      true,
    );

    expect(dto.heatmap).toEqual([]);
    expect(dto.byWeekday).toHaveLength(7);
    expect(dto.byHour).toHaveLength(24);
    expect(dto.byHour.every((b) => b.count === 0)).toBe(true);
    expect(dto.mostActiveYear).toBeNull();
  });

  it("zeroes the whole social section without ee/", async () => {
    const dto = await makeServiceWith({}).getSocialStats("user-1", true);

    expect(dto.reviewsWritten).toBe(0);
    expect(dto.ratingVsCommunity).toEqual({
      sufficientData: false,
      sampleSize: 0,
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
    // The query must not read unrelated EpisodeWatch rows.
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
