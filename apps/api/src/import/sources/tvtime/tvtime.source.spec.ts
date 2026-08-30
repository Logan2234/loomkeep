import type {
  ImportAnalyzeRequest,
  ImportCommitRequest,
  ImportPlan,
  ImportPlanItem,
} from "@loomkeep/shared";
import { vi } from "vitest";
import { ImportJobService } from "../../import-job.service";
import { makeZip } from "../../make-zip";
import { TvTimeImportSource } from "./tvtime.source";

// Two watched episodes of one show (TVDB 100), plus a never-started show (200).
const EPISODES_CSV = [
  "series_name,episode_id,season_number,episode_number,s_id,bulk_type,created_at",
  "My Show,900,1,1,100,,2024-01-01 10:00:00",
  "My Show,901,1,2,100,,2024-01-02 10:00:00",
].join("\n");
const SHOWS_CSV = [
  "tv_show_name,tv_show_id,nb_episodes_seen",
  "My Show,100,2",
  "Planned Show,200,0",
].join("\n");
const EMPTY_SHOWS = "tv_show_name,tv_show_id,nb_episodes_seen";
const EMPTY_EPISODES =
  "series_name,episode_id,season_number,episode_number,s_id,bulk_type,created_at";

/** Pack the given CSVs into a base64 TV Time archive for the `input` field. */
function zipBase64(files: {
  episodesCsv?: string;
  showsCsv?: string;
  recordsCsv?: string;
  rewatchedCsv?: string;
}): string {
  const names: Record<string, string> = {
    episodesCsv: "tracking-prod-records-v2.csv",
    showsCsv: "user_tv_show_data.csv",
    recordsCsv: "tracking-prod-records.csv",
    rewatchedCsv: "rewatched_episode.csv",
  };
  const entries = Object.entries(files)
    .filter(([, content]) => content !== undefined)
    .map(([field, content]) => ({ name: names[field], content: content! }));
  return makeZip(entries).toString("base64");
}

function analyzeDto(
  files: Parameters<typeof zipBase64>[0],
): ImportAnalyzeRequest {
  return { input: zipBase64(files) };
}

function makeService() {
  const prisma = {
    season: { findMany: vi.fn() },
    episode: { count: vi.fn() },
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
    upsertFromSource: vi.fn().mockResolvedValue({ id: "media-100" }),
  };
  const tmdb = {
    findSeriesSummaryByTvdbId: vi.fn().mockResolvedValue(null),
    search: vi.fn().mockResolvedValue([]),
  };
  const source = new TvTimeImportSource(
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

/** All plan items flattened, plus a group lookup by id. */
function group(plan: ImportPlan, id: string): ImportPlanItem[] {
  return plan.groups.find((g) => g.id === id)?.items ?? [];
}

describe("TvTimeImportSource (via ImportJobService)", () => {
  it("analyze builds a reconciliation plan without writing anything", async () => {
    const { prisma, tmdb, service } = makeService();
    // Only TVDB 100 resolves; the watchlist show (200) stays unresolved.
    tmdb.findSeriesSummaryByTvdbId.mockImplementation((tvdbId: string) =>
      Promise.resolve(
        tvdbId === "100"
          ? {
              source: "TMDB",
              sourceId: "500",
              type: "SERIES",
              title: "My Show",
              year: 2024,
              posterUrl: null,
            }
          : null,
      ),
    );

    const { id } = await service.startAnalyze(
      "u1",
      "tvtime",
      analyzeDto({ episodesCsv: EPISODES_CSV, showsCsv: SHOWS_CSV }),
    );
    const job = await runToEnd(service, "u1", id);

    expect(job.status).toBe("completed");
    expect(job.plan).not.toBeNull();
    const tracked = group(job.plan!, "seriesTracked");
    expect(tracked).toHaveLength(1);
    expect(tracked[0]).toMatchObject({
      key: "tvdb:100",
      title: "My Show",
      subtitle: "2 épisodes vus",
      include: true,
      match: { sourceId: "500", source: "TMDB" },
    });
    const watchlist = group(job.plan!, "seriesWatchlist");
    expect(watchlist).toHaveLength(1);
    expect(watchlist[0]).toMatchObject({
      key: "tvdb:200",
      match: null,
      include: false,
    });
    expect(job.plan!.counts).toEqual({
      total: 2,
      matched: 1,
      unresolved: 1,
      apiErrors: 0,
    });
    expect(prisma.libraryEntry.upsert).not.toHaveBeenCalled();
    expect(prisma.episodeWatch.createMany).not.toHaveBeenCalled();
  });

  it("analyze resolves movies and flags the unmatched ones", async () => {
    const { tmdb, service } = makeService();
    tmdb.search.mockImplementation((title: string) =>
      Promise.resolve(
        title === "Seen Film"
          ? [
              {
                source: "TMDB",
                sourceId: "m1",
                type: "MOVIE",
                title: "Seen Film",
                year: 2020,
                posterUrl: null,
                originalTitle: null,
              },
            ]
          : [],
      ),
    );

    const recordsCsv = [
      "type,entity_type,movie_name,release_date",
      "watch,movie,Seen Film,2020-01-01 00:00:00",
      "towatch,movie,Later Film,2021-01-01 00:00:00",
    ].join("\n");

    const { id } = await service.startAnalyze(
      "u1",
      "tvtime",
      analyzeDto({
        episodesCsv: EMPTY_EPISODES,
        showsCsv: EMPTY_SHOWS,
        recordsCsv,
      }),
    );
    const job = await runToEnd(service, "u1", id);

    const watched = group(job.plan!, "moviesWatched");
    expect(watched).toHaveLength(1);
    expect(watched[0]).toMatchObject({
      title: "Seen Film",
      include: true,
      match: { sourceId: "m1" },
    });
    const watchlist = group(job.plan!, "moviesWatchlist");
    expect(watchlist[0]).toMatchObject({
      title: "Later Film",
      match: null,
      include: false,
    });
    expect(job.plan!.counts).toMatchObject({ total: 2, unresolved: 1 });
  });

  it("commit writes only the included items", async () => {
    const { prisma, mediaItemService, tmdb, service } = makeService();
    tmdb.findSeriesSummaryByTvdbId.mockImplementation((tvdbId: string) =>
      Promise.resolve(
        tvdbId === "100"
          ? {
              source: "TMDB",
              sourceId: "500",
              type: "SERIES",
              title: "My Show",
              year: 2024,
              posterUrl: null,
            }
          : null,
      ),
    );
    prisma.season.findMany.mockResolvedValue([
      {
        number: 1,
        episodes: [
          { id: "e1", number: 1 },
          { id: "e2", number: 2 },
        ],
      },
    ]);
    prisma.mediaExternalId.findUnique.mockResolvedValue({
      mediaItemId: "media-100",
    });

    const analyze = await service.startAnalyze(
      "u1",
      "tvtime",
      analyzeDto({ episodesCsv: EPISODES_CSV, showsCsv: SHOWS_CSV }),
    );
    await runToEnd(service, "u1", analyze.id);

    // Keep only the resolved tracked show; the unresolved watchlist one (200)
    // is left out, so nothing is written for it.
    const commitDto: ImportCommitRequest = { include: ["tvdb:100"] };
    const commit = service.commit("u1", "tvtime", analyze.id, commitDto);
    const job = await runToEnd(service, "u1", commit.id);

    expect(job.status).toBe("completed");
    expect(mediaItemService.upsertFromSource).toHaveBeenCalledWith(
      "TMDB",
      "500",
      "SERIES",
    );
    expect(prisma.episodeWatch.createMany).toHaveBeenCalledTimes(2);
    const tile = (label: string) =>
      job.report!.tiles.find((t) => t.label === label);
    expect(tile("Séries")!.value).toBe(1);
    expect(tile("Épisodes")!.value).toBe(2);
  });

  it("commit applies a manual override for an unresolved movie", async () => {
    const { mediaItemService, service } = makeService(); // tmdb.search → [] (all unresolved)

    const recordsCsv = [
      "type,entity_type,movie_name,release_date",
      "towatch,movie,Later Film,2021-01-01 00:00:00",
    ].join("\n");
    const analyze = await service.startAnalyze(
      "u1",
      "tvtime",
      analyzeDto({
        episodesCsv: EMPTY_EPISODES,
        showsCsv: EMPTY_SHOWS,
        recordsCsv,
      }),
    );
    await runToEnd(service, "u1", analyze.id);

    const key = "movie:later film:2021";
    const commit = service.commit("u1", "tvtime", analyze.id, {
      include: [key],
      overrides: { [key]: { source: "TMDB", sourceId: "m2", type: "MOVIE" } },
    });
    const job = await runToEnd(service, "u1", commit.id);

    expect(job.status).toBe("completed");
    expect(mediaItemService.upsertFromSource).toHaveBeenCalledWith(
      "TMDB",
      "m2",
      "MOVIE",
    );
    const films = job.report!.tiles.find((t) => t.label === "Films");
    expect(films!.value).toBe(0);
    expect(films!.sub).toBe("1 en watchlist");
  });

  it("commit with overwrite wipes history and library first", async () => {
    const { prisma, tmdb, service } = makeService();
    tmdb.findSeriesSummaryByTvdbId.mockResolvedValue({
      source: "TMDB",
      sourceId: "500",
      type: "SERIES",
      title: "My Show",
      year: 2024,
      posterUrl: null,
    });
    prisma.season.findMany.mockResolvedValue([
      { number: 1, episodes: [{ id: "e1", number: 1 }] },
    ]);
    prisma.mediaExternalId.findUnique.mockResolvedValue({
      mediaItemId: "media-100",
    });

    const analyze = await service.startAnalyze(
      "u1",
      "tvtime",
      analyzeDto({ episodesCsv: EPISODES_CSV, showsCsv: SHOWS_CSV }),
    );
    await runToEnd(service, "u1", analyze.id);

    const commit = service.commit("u1", "tvtime", analyze.id, {
      include: ["tvdb:100"],
      overwrite: true,
    });
    const job = await runToEnd(service, "u1", commit.id);

    expect(job.status).toBe("completed");
    expect(job.report!.overwrite).toBe(true);
    expect(prisma.episodeWatch.deleteMany).toHaveBeenCalledWith({
      where: { userId: "u1" },
    });
    expect(prisma.libraryEntry.deleteMany).toHaveBeenCalledWith({
      where: { userId: "u1" },
    });
  });

  it("rejects an archive missing a required file", async () => {
    const { service } = makeService();
    // No user_tv_show_data.csv → required file absent.
    await expect(
      service.startAnalyze(
        "u1",
        "tvtime",
        analyzeDto({ episodesCsv: EPISODES_CSV }),
      ),
    ).rejects.toThrow(/user_tv_show_data\.csv/);
  });
});
