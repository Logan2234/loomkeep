import { ConfigService } from "@nestjs/config";
import { GameSource } from "@loomkeep/shared";
import type { ImportPlan, ImportPlanItem } from "@loomkeep/shared";
import type { ProviderGameDetails } from "../../../games/providers/game-provider.types";
import type { QuotaTrackerService } from "../../../common/quota-tracker.service";
import { GameItemService } from "../../../games/game-item.service";
import { IgdbProvider } from "../../../games/providers/igdb.provider";
import { PrismaService } from "../../../prisma/prisma.service";
import { AgeGateService } from "../../../users/age-gate.service";
import { ImportJobService } from "../../import-job.service";
import { SteamImportSource } from "./steam.source";

const originalFetch = global.fetch;

function mockFetchByUrl(routes: Record<string, unknown>): jest.Mock {
  const fn = jest.fn((input: RequestInfo | URL) => {
    const url = String(input);
    const match = Object.entries(routes).find(([part]) => url.includes(part));
    if (!match) throw new Error(`Unexpected fetch call in test: ${url}`);
    return Promise.resolve(
      new Response(JSON.stringify(match[1]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
  });
  global.fetch = fn as unknown as typeof fetch;
  return fn;
}

function detail(id: string, adult = false): ProviderGameDetails {
  return {
    summary: {
      source: GameSource.IGDB,
      sourceId: id,
      title: `Game ${id}`,
      year: 2020,
      coverUrl: `cover-${id}`,
      isAdult: adult,
    },
    overview: null,
    backdropUrl: null,
    genres: [],
    platforms: [],
    releaseDate: null,
    externalIds: [{ source: GameSource.IGDB, externalId: id }],
  };
}

interface Mocks {
  igdb: { matchSteamAppIds: jest.Mock; getDetailsByIds: jest.Mock };
  gameItemService: { persistDetails: jest.Mock };
  ageGate: { allowsAdultContent: jest.Mock };
  prisma: {
    gameExternalId: { findMany: jest.Mock };
    gameEntry: {
      findMany: jest.Mock;
      upsert: jest.Mock;
      deleteMany: jest.Mock;
    };
  };
}

function build(over: Partial<Mocks> = {}): {
  service: ImportJobService;
  mocks: Mocks;
} {
  const mocks: Mocks = {
    igdb: {
      matchSteamAppIds: jest.fn().mockResolvedValue(new Map()),
      getDetailsByIds: jest.fn().mockResolvedValue([]),
      ...over.igdb,
    },
    gameItemService: { persistDetails: jest.fn(), ...over.gameItemService },
    ageGate: {
      allowsAdultContent: jest.fn().mockResolvedValue(false),
      ...over.ageGate,
    },
    prisma: {
      gameExternalId: { findMany: jest.fn().mockResolvedValue([]) },
      gameEntry: {
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn(),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      ...over.prisma,
    },
  };
  const prismaExtras = {
    user: {
      findUnique: jest.fn().mockResolvedValue({ email: "test@example.com" }),
    },
    importRun: { create: jest.fn() },
  };
  const config = { getOrThrow: jest.fn().mockReturnValue("steam-key") };
  const quota = { record: jest.fn() };
  const source = new SteamImportSource(
    config as unknown as ConfigService,
    mocks.prisma as unknown as PrismaService,
    mocks.igdb as unknown as IgdbProvider,
    mocks.gameItemService as unknown as GameItemService,
    mocks.ageGate as unknown as AgeGateService,
    quota as unknown as QuotaTrackerService,
  );
  const service = new ImportJobService([source], {
    ...mocks.prisma,
    ...prismaExtras,
  } as unknown as PrismaService);
  return { service, mocks };
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

describe("SteamImportSource (via ImportJobService)", () => {
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("matches owned games to IGDB, filtering adult titles and grouping by status", async () => {
    const { service, mocks } = build({
      igdb: {
        matchSteamAppIds: jest.fn().mockResolvedValue(
          new Map([
            ["10", "100"],
            ["20", "200"],
            ["30", "300"],
          ]),
        ),
        getDetailsByIds: jest
          .fn()
          .mockResolvedValue([
            detail("100"),
            detail("200"),
            detail("300", true),
          ]),
      },
      prisma: {
        gameExternalId: {
          findMany: jest
            .fn()
            .mockResolvedValue([{ externalId: "200", gameItemId: "gi200" }]),
        },
        gameEntry: {
          findMany: jest.fn().mockResolvedValue([{ gameItemId: "gi200" }]),
          upsert: jest.fn(),
          deleteMany: jest.fn(),
        },
      },
    });

    mockFetchByUrl({
      GetOwnedGames: {
        response: {
          game_count: 4,
          games: [
            { appid: 10, playtime_forever: 600 },
            { appid: 20, playtime_forever: 100, playtime_2weeks: 30 },
            { appid: 30, playtime_forever: 50 }, // adult → filtered
            { appid: 40, playtime_forever: 5 }, // unmatched
          ],
        },
      },
    });

    const started = service.startAnalyze("user1", "steam", {
      input: "76561197960287930",
    });
    const job = await runToEnd(service, "user1", started.id);

    expect(job.status).toBe("completed");
    // Adult (300) excluded entirely; 100 + 200 matched, 40 unmatched.
    expect(job.plan!.counts).toEqual({
      total: 3,
      matched: 2,
      unresolved: 1,
      apiErrors: 0,
    });
    expect(byKey(job.plan!, "g100")).toMatchObject({
      sourceTitle: "Game 100",
      subtitle: "10 h",
      defaultStatus: "BACKLOG",
      include: true,
      match: { source: "IGDB", sourceId: "100" },
    });
    expect(byKey(job.plan!, "g200")).toMatchObject({
      subtitle: "2 h · joué récemment",
      defaultStatus: "PLAYING",
      alreadyInLibrary: true,
      include: false, // already tracked
    });
    expect(byKey(job.plan!, "u40")).toMatchObject({
      match: null,
      subtitle: "< 1 h",
    });
    expect(mocks.igdb.matchSteamAppIds).toHaveBeenCalledWith([
      "10",
      "20",
      "30",
      "40",
    ]);
  });

  it("resolves a vanity profile URL through Steam", async () => {
    const { service } = build();
    const fetchMock = mockFetchByUrl({
      ResolveVanityURL: {
        response: { success: 1, steamid: "76561190000000000" },
      },
      GetOwnedGames: { response: { game_count: 0, games: [] } },
    });

    const started = service.startAnalyze("user1", "steam", {
      input: "https://steamcommunity.com/id/gaben",
    });
    const job = await runToEnd(service, "user1", started.id);

    expect(job.status).toBe("completed");
    const vanityCall = fetchMock.mock.calls.find(([u]) =>
      String(u).includes("ResolveVanityURL"),
    );
    expect(String(vanityCall?.[0])).toContain("vanityurl=gaben");
  });

  it("fails the job with a clear error when the profile is private", async () => {
    const { service } = build();
    mockFetchByUrl({ GetOwnedGames: { response: {} } });

    const started = service.startAnalyze("user1", "steam", {
      input: "76561197960287930",
    });
    const job = await runToEnd(service, "user1", started.id);

    expect(job.status).toBe("failed");
    expect(job.error).toMatch(/public/i);
  });

  it("commit persists chosen games and skips adult titles disabled at commit time", async () => {
    const { service, mocks } = build({
      igdb: {
        matchSteamAppIds: jest.fn().mockResolvedValue(
          new Map([
            ["10", "100"],
            ["30", "300"],
          ]),
        ),
        getDetailsByIds: jest
          .fn()
          .mockResolvedValue([detail("100"), detail("300", true)]),
      },
      gameItemService: {
        persistDetails: jest
          .fn()
          .mockImplementation((_s, d: ProviderGameDetails) =>
            Promise.resolve({ id: `gi-${d.summary.sourceId}` }),
          ),
      },
      ageGate: {
        // Opted-in during analyze (300 lands in the plan), opted-out at commit.
        allowsAdultContent: jest
          .fn()
          .mockResolvedValueOnce(true)
          .mockResolvedValue(false),
      },
    });

    mockFetchByUrl({
      GetOwnedGames: {
        response: {
          game_count: 2,
          games: [
            { appid: 10, playtime_forever: 600 },
            { appid: 30, playtime_forever: 50 },
          ],
        },
      },
    });

    const analyzed = service.startAnalyze("user1", "steam", {
      input: "76561197960287930",
    });
    await runToEnd(service, "user1", analyzed.id);

    const committed = service.commit("user1", "steam", analyzed.id, {
      include: ["g100", "g300"],
      statuses: { g100: "PLAYING" },
    });
    const job = await runToEnd(service, "user1", committed.id);

    expect(job.status).toBe("completed");
    // Only the non-adult game is written; 300 is skipped by the commit guard.
    expect(mocks.gameItemService.persistDetails).toHaveBeenCalledTimes(1);
    expect(mocks.prisma.gameEntry.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          userId: "user1",
          gameItemId: "gi-100",
          status: "PLAYING",
          playtimeMinutes: 600,
          ownershipStatus: "DIGITAL",
          ownershipSource: "Steam",
        }),
      }),
    );
  });
});
