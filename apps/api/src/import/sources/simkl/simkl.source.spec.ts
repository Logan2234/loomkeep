import type { ImportPlan, ImportPlanItem } from "@loomkeep/shared";
import { ConfigService } from "@nestjs/config";
import { MediaItemService } from "../../../catalog/media-item.service";
import { TmdbProvider } from "../../../catalog/providers/tmdb.provider";
import type { QuotaTrackerService } from "../../../common/quota-tracker.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { ImportJobService } from "../../import-job.service";
import { SimklImportSource } from "./simkl.source";

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
  const config = {
    getOrThrow: jest.fn().mockReturnValue("simkl-client-id"),
    get: jest.fn().mockReturnValue(undefined),
  };
  const quota = { record: jest.fn() };
  const source = new SimklImportSource(
    prisma as never,
    mediaItemService as unknown as MediaItemService,
    tmdb as unknown as TmdbProvider,
    {} as never,
    config as unknown as ConfigService,
    quota as unknown as QuotaTrackerService,
  );
  const service = new ImportJobService(
    [source],
    prisma as unknown as PrismaService,
    {} as never,
    { isEffectivelyPremium: jest.fn().mockResolvedValue(true) } as never,
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

describe("SimklImportSource (via ImportJobService)", () => {
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("exchanges the code, then resolves watched shows/movies via TMDB", async () => {
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
      sourceId: "238",
      type: "MOVIE",
      title: "The Godfather",
      year: 1972,
      posterUrl: null,
    });

    mockFetchByUrl({
      "oauth/token": { access_token: "abc123" },
      "sync/all-items": {
        shows: [
          {
            status: "watching",
            show: {
              title: "Breaking Bad",
              year: 2008,
              ids: { simkl: 1, tmdb: "1396" },
            },
            seasons: [
              {
                number: 1,
                episodes: [
                  { number: 1, watched_at: "2014-10-15T22:24:29.000Z" },
                ],
              },
            ],
          },
        ],
        movies: [
          {
            status: "completed",
            movie: {
              title: "The Godfather",
              year: 1972,
              ids: { simkl: 2, tmdb: "238" },
            },
          },
        ],
      },
    });

    const started = await service.startAnalyze("u1", "simkl", {
      input: "the-oauth-code",
    });
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
    expect(byKey(job.plan!, "tmdb:238")).toMatchObject({
      title: "The Godfather",
      include: true,
    });
  });

  it("fails the job with a clear error when the code exchange fails", async () => {
    const { service } = makeService();
    mockFetchByUrl({ "oauth/token": 400 });

    const started = await service.startAnalyze("u1", "simkl", {
      input: "stale-code",
    });
    const job = await runToEnd(service, "u1", started.id);

    expect(job.status).toBe("failed");
    expect(job.error).toMatch(/impossible/i);
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
      "oauth/token": { access_token: "abc123" },
      "sync/all-items": {
        shows: [
          {
            status: "watching",
            show: {
              title: "Breaking Bad",
              year: 2008,
              ids: { simkl: 1, tmdb: "1396" },
            },
            seasons: [
              {
                number: 1,
                episodes: [
                  { number: 1, watched_at: "2014-10-15T22:24:29.000Z" },
                ],
              },
            ],
          },
        ],
      },
    });

    const analyzed = await service.startAnalyze("u1", "simkl", {
      input: "the-oauth-code",
    });
    await runToEnd(service, "u1", analyzed.id);

    const committed = service.commit("u1", "simkl", analyzed.id, {
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
  });
});
