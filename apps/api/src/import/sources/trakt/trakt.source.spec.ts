import { ConfigService } from "@nestjs/config";
import type { ImportPlan, ImportPlanItem } from "@loomkeep/shared";
import type { QuotaTrackerService } from "../../../common/quota-tracker.service";
import { MediaItemService } from "../../../catalog/media-item.service";
import { TmdbProvider } from "../../../catalog/providers/tmdb.provider";
import { PrismaService } from "../../../prisma/prisma.service";
import { ImportJobService } from "../../import-job.service";
import { TraktImportSource } from "./trakt.source";

const originalFetch = global.fetch;

function mockFetchByUrl(routes: Record<string, unknown>): jest.Mock {
  const fn = jest.fn((input: RequestInfo | URL) => {
    const url = String(input);
    const match = Object.entries(routes).find(([part]) => url.includes(part));
    if (!match) throw new Error(`Unexpected fetch call in test: ${url}`);
    const [, body] = match;

    if (typeof body === "number") {
      return Promise.resolve(new Response(null, { status: body }));
    }

    return Promise.resolve(
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
  });
  global.fetch = fn as unknown as typeof fetch;
  return fn;
}

function makeService() {
  const prisma = {
    season: { findMany: jest.fn().mockResolvedValue([]) },
    episodeWatch: {
      count: jest.fn().mockResolvedValue(0),
      createMany: jest.fn(),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    mediaExternalId: { findUnique: jest.fn() },
    libraryEntry: {
      upsert: jest.fn(),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue({ email: "test@example.com" }),
    },
    importRun: { create: jest.fn() },
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };
  const mediaItemService = {
    upsertFromSource: jest.fn().mockResolvedValue({ id: "media-1" }),
  };
  const tmdb = {
    getSeriesSummaryByTmdbId: jest.fn().mockRejectedValue(new Error("404")),
    getMovieSummaryByTmdbId: jest.fn().mockRejectedValue(new Error("404")),
    findSeriesSummaryByTvdbId: jest.fn().mockResolvedValue(null),
    findSeriesSummaryByImdbId: jest.fn().mockResolvedValue(null),
    findMovieSummaryByImdbId: jest.fn().mockResolvedValue(null),
    search: jest.fn().mockResolvedValue([]),
  };
  const config = { getOrThrow: jest.fn().mockReturnValue("trakt-client-id") };
  const quota = { record: jest.fn() };
  const source = new TraktImportSource(
    prisma as never,
    mediaItemService as unknown as MediaItemService,
    tmdb as unknown as TmdbProvider,
    config as unknown as ConfigService,
    quota as unknown as QuotaTrackerService,
  );
  const service = new ImportJobService(
    [source],
    prisma as unknown as PrismaService,
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
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("resolves watched shows and movies directly via their TMDB id", async () => {
    const { service, tmdb } = makeService();
    tmdb.getSeriesSummaryByTmdbId.mockResolvedValue({
      source: "TMDB",
      sourceId: "1396",
      type: "SERIES",
      title: "Breaking Bad",
      year: 2008,
      posterUrl: null,
    });
    tmdb.getMovieSummaryByTmdbId.mockResolvedValue({
      source: "TMDB",
      sourceId: "118340",
      type: "MOVIE",
      title: "Guardians of the Galaxy",
      year: 2014,
      posterUrl: null,
    });

    mockFetchByUrl({
      "watched/shows": [
        {
          show: {
            title: "Breaking Bad",
            year: 2008,
            ids: { trakt: 1, tmdb: 1396 },
          },
          seasons: [
            {
              number: 1,
              episodes: [
                {
                  number: 1,
                  plays: 1,
                  last_watched_at: "2014-10-15T22:24:29.000Z",
                },
              ],
            },
          ],
        },
      ],
      "watched/movies": [
        {
          movie: {
            title: "Guardians of the Galaxy",
            year: 2014,
            ids: { trakt: 28, tmdb: 118340 },
          },
        },
      ],
      "watchlist/shows": [],
      "watchlist/movies": [],
    });

    const started = service.startAnalyze("u1", "trakt", { input: "someuser" });
    const job = await runToEnd(service, "u1", started.id);

    expect(job.status).toBe("completed");
    expect(job.plan!.counts).toEqual({
      total: 2,
      matched: 2,
      unresolved: 0,
      apiErrors: 0,
    });
    expect(byKey(job.plan!, "tmdb:1396")).toMatchObject({
      title: "Breaking Bad",
      subtitle: "1 épisode vu",
      include: true,
    });
    expect(byKey(job.plan!, "tmdb:118340")).toMatchObject({
      title: "Guardians of the Galaxy",
      include: true,
    });
    expect(tmdb.getSeriesSummaryByTmdbId).toHaveBeenCalledWith("1396");
    expect(tmdb.getMovieSummaryByTmdbId).toHaveBeenCalledWith("118340");
  });

  it("fails the job with a clear error when the profile is private", async () => {
    const { service } = makeService();
    mockFetchByUrl({
      "watched/shows": 404,
      "watched/movies": 404,
      "watchlist/shows": 404,
      "watchlist/movies": 404,
    });

    const started = service.startAnalyze("u1", "trakt", { input: "ghost" });
    const job = await runToEnd(service, "u1", started.id);

    expect(job.status).toBe("failed");
    expect(job.error).toMatch(/priv/i);
  });

  it("commit writes episode watches and library entries", async () => {
    const { service, prisma, mediaItemService, tmdb } = makeService();
    tmdb.getSeriesSummaryByTmdbId.mockResolvedValue({
      source: "TMDB",
      sourceId: "1396",
      type: "SERIES",
      title: "Breaking Bad",
      year: 2008,
      posterUrl: null,
    });
    prisma.season.findMany.mockResolvedValue([
      { number: 1, episodes: [{ id: "ep-1", number: 1 }] },
    ]);
    prisma.mediaExternalId.findUnique.mockResolvedValue({
      mediaItemId: "media-1",
    });

    mockFetchByUrl({
      "watched/shows": [
        {
          show: {
            title: "Breaking Bad",
            year: 2008,
            ids: { trakt: 1, tmdb: 1396 },
          },
          seasons: [
            {
              number: 1,
              episodes: [
                {
                  number: 1,
                  plays: 1,
                  last_watched_at: "2014-10-15T22:24:29.000Z",
                },
              ],
            },
          ],
        },
      ],
      "watched/movies": [],
      "watchlist/shows": [],
      "watchlist/movies": [],
    });

    const analyzed = service.startAnalyze("u1", "trakt", { input: "someuser" });
    await runToEnd(service, "u1", analyzed.id);

    const committed = service.commit("u1", "trakt", analyzed.id, {
      include: ["tmdb:1396"],
    });
    const job = await runToEnd(service, "u1", committed.id);

    expect(job.status).toBe("completed");
    expect(mediaItemService.upsertFromSource).toHaveBeenCalledWith(
      "TMDB",
      "1396",
      "SERIES",
    );
    expect(prisma.episodeWatch.createMany).toHaveBeenCalledWith({
      data: [
        {
          userId: "u1",
          episodeId: "ep-1",
          watchedAt: new Date("2014-10-15T22:24:29.000Z"),
        },
      ],
    });
    expect(job.report!.tiles[0]).toMatchObject({ label: "Séries", value: 1 });
  });
});
