import type { ImportPlan, ImportPlanItem } from "@loomkeep/shared";
import { vi } from "vitest";
import { ImportJobService } from "../../import-job.service";
import { makeZip } from "../../make-zip";
import { TraktImportSource } from "./trakt.source";

const HISTORY = JSON.stringify([
  {
    watched_at: "2026-07-01T20:49:00.000Z",
    type: "episode",
    episode: { title: "Good vs. Evil", season: 2, number: 1 },
    show: {
      title: "Record of Ragnarok",
      year: 2021,
      ids: { trakt: 171086, tmdb: 114868 },
    },
  },
  {
    watched_at: "2026-06-27T17:46:00.000Z",
    type: "movie",
    movie: {
      title: "Backrooms",
      year: 2026,
      ids: { trakt: 870815, tmdb: 1083381 },
    },
  },
]);

function zipBase64(files: { name: string; content: string }[]): string {
  return makeZip(files).toString("base64");
}

function makeService() {
  const prisma = {
    season: { findMany: vi.fn().mockResolvedValue([]) },
    episodeWatch: {
      count: vi.fn().mockResolvedValue(0),
      createMany: vi.fn(),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    mediaExternalId: { findUnique: vi.fn() },
    libraryEntry: {
      upsert: vi.fn(),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue({ email: "test@example.com" }),
    },
    importRun: { create: vi.fn() },
    $transaction: vi.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };
  const mediaItemService = {
    upsertFromSource: vi.fn().mockResolvedValue({ id: "media-1" }),
  };
  const tmdb = {
    getSeriesSummaryByTmdbId: vi.fn().mockRejectedValue(new Error("404")),
    getMovieSummaryByTmdbId: vi.fn().mockRejectedValue(new Error("404")),
    findSeriesSummaryByTvdbId: vi.fn().mockResolvedValue(null),
    findSeriesSummaryByImdbId: vi.fn().mockResolvedValue(null),
    findMovieSummaryByImdbId: vi.fn().mockResolvedValue(null),
    search: vi.fn().mockResolvedValue([]),
  };
  const source = new TraktImportSource(
    prisma as never,
    mediaItemService as never,
    tmdb as never,
    {} as never,
  );
  const service = new ImportJobService(
    [source],
    prisma as never,
    {} as never,
    { isEffectivelyPremium: vi.fn().mockResolvedValue(true) } as never,
    { award: vi.fn(), awardMany: vi.fn(), revokeBySource: vi.fn() } as never, // XpService stub
    { evaluate: vi.fn() } as never, // AchievementService stub
  );
  return { prisma, mediaItemService, tmdb, service };
}

async function runToEnd(
  service: ImportJobService,
  userId: string,
  jobId: string,
) {
  for (let i = 0; i < 100; i++) {
    if (service.getJob(userId, jobId).status !== "running") break;
    await new Promise((resolve) => setImmediate(resolve));
  }

  return service.getJob(userId, jobId);
}

function items(plan: ImportPlan): ImportPlanItem[] {
  return plan.groups.flatMap((g) => g.items);
}

function byKey(plan: ImportPlan, key: string): ImportPlanItem | undefined {
  return items(plan).find((it) => it.key === key);
}

describe("TraktImportSource (via ImportJobService)", () => {
  it("reads a single unsplit watched-history.json and resolves via TMDB", async () => {
    const { service, tmdb } = makeService();
    tmdb.getSeriesSummaryByTmdbId.mockResolvedValue({
      source: "TMDB",
      sourceId: "114868",
      type: "SERIES",
      title: "Record of Ragnarok",
      year: 2021,
      posterUrl: null,
    });
    tmdb.getMovieSummaryByTmdbId.mockResolvedValue({
      source: "TMDB",
      sourceId: "1083381",
      type: "MOVIE",
      title: "Backrooms",
      year: 2026,
      posterUrl: null,
    });

    const input = zipBase64([
      { name: "watched-history.json", content: HISTORY },
    ]);
    const started = await service.startAnalyze("u1", "trakt", { input });
    const job = await runToEnd(service, "u1", started.id);

    expect(job.status).toBe("completed");
    expect(job.plan!.counts).toEqual({
      total: 2,
      matched: 2,
      unresolved: 0,
      apiErrors: 0,
    });
    expect(byKey(job.plan!, "tmdb:114868")).toMatchObject({
      title: "Record of Ragnarok",
      subtitle: "1 épisode vu",
    });
    expect(byKey(job.plan!, "tmdb:1083381")).toMatchObject({
      title: "Backrooms",
    });
  });

  it("concatenates paginated watched-history-N.json parts", async () => {
    const { service, tmdb } = makeService();
    tmdb.getMovieSummaryByTmdbId.mockResolvedValue({
      source: "TMDB",
      sourceId: "1083381",
      type: "MOVIE",
      title: "Backrooms",
      year: 2026,
      posterUrl: null,
    });

    const movieOnly = JSON.stringify([JSON.parse(HISTORY)[1]]);
    const episodeOnly = JSON.stringify([JSON.parse(HISTORY)[0]]);
    const input = zipBase64([
      { name: "watched-history-1.json", content: movieOnly },
      { name: "watched-history-2.json", content: episodeOnly },
    ]);

    const started = await service.startAnalyze("u1", "trakt", { input });
    const job = await runToEnd(service, "u1", started.id);

    expect(job.status).toBe("completed");
    expect(job.plan!.counts.total).toBe(2);
  });

  it("throws immediately when the archive has no history file", async () => {
    const { service } = makeService();
    const input = zipBase64([{ name: "user-profile.json", content: "{}" }]);

    await expect(
      service.startAnalyze("u1", "trakt", { input }),
    ).rejects.toThrow(/watched-history/i);
  });

  it("commit writes episode watches and library entries", async () => {
    const { service, prisma, mediaItemService, tmdb } = makeService();
    tmdb.getSeriesSummaryByTmdbId.mockResolvedValue({
      source: "TMDB",
      sourceId: "114868",
      type: "SERIES",
      title: "Record of Ragnarok",
      year: 2021,
      posterUrl: null,
    });
    prisma.season.findMany.mockResolvedValue([
      { number: 2, episodes: [{ id: "ep-1", number: 1 }] },
    ]);
    prisma.mediaExternalId.findUnique.mockResolvedValue({
      mediaItemId: "media-1",
    });

    const episodeOnly = JSON.stringify([JSON.parse(HISTORY)[0]]);
    const input = zipBase64([
      { name: "watched-history.json", content: episodeOnly },
    ]);

    const analyzed = await service.startAnalyze("u1", "trakt", { input });
    await runToEnd(service, "u1", analyzed.id);

    const committed = service.commit("u1", "trakt", analyzed.id, {
      include: ["tmdb:114868"],
    });
    const job = await runToEnd(service, "u1", committed.id);

    expect(job.status).toBe("completed");
    expect(mediaItemService.upsertFromSource).toHaveBeenCalledWith(
      "TMDB",
      "114868",
      "SERIES",
    );
    expect(prisma.episodeWatch.createMany).toHaveBeenCalledWith({
      data: [
        {
          userId: "u1",
          episodeId: "ep-1",
          watchedAt: new Date("2026-07-01T20:49:00.000Z"),
        },
      ],
    });
  });
});
