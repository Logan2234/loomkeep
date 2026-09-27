import { vi, type Mock } from "vitest";
import type { JobRunService } from "../jobs/job-run.service";
import type { PrismaService } from "../prisma/prisma.service";
import { GameItemService } from "./game-item.service";
import type { ProviderGameDetails } from "./providers/game-provider.types";
import type { IgdbProvider } from "./providers/igdb.provider";

const details: ProviderGameDetails = {
  summary: {
    source: "IGDB",
    sourceId: "42",
    title: "Some Game",
    year: 2020,
    coverUrl: null,
    isAdult: false,
  },
  overview: null,
  backdropUrl: null,
  screenshots: [],
  genres: [],
  platforms: [],
  releaseDate: null,
  website: null,
  similarGames: [],
  developers: [],
  publishers: [],
  gameModes: [],
  playerPerspectives: [],
  franchiseGames: [],
  ratings: [],
  externalIds: [{ source: "IGDB", externalId: "42" }],
  timeToBeat: null,
  sourceUrl: null,
} as unknown as ProviderGameDetails;

const jobRunsStub = {
  record: (_key: string, fn: () => Promise<unknown>) => fn(),
} as unknown as JobRunService;

function makeService(overrides: {
  gameExternalId?: unknown;
  getDetails?: Mock;
  getDetailsByIds?: Mock;
  staleItems?: unknown[];
}) {
  const prisma = {
    gameExternalId: {
      findUnique: vi.fn().mockResolvedValue(overrides.gameExternalId ?? null),
      upsert: vi.fn(),
    },
    gameItem: {
      create: vi.fn().mockResolvedValue({ id: "created" }),
      update: vi.fn().mockResolvedValue({ id: "updated" }),
      findMany: vi.fn().mockResolvedValue(overrides.staleItems ?? []),
    },
  } as unknown as PrismaService;
  const igdbProvider = {
    getDetails: overrides.getDetails ?? vi.fn().mockResolvedValue(details),
    getDetailsByIds:
      overrides.getDetailsByIds ?? vi.fn().mockResolvedValue([details]),
  } as unknown as IgdbProvider;
  const service = new GameItemService(prisma, igdbProvider, jobRunsStub);
  return { service, prisma, igdbProvider };
}

describe("GameItemService.upsertFromSource", () => {
  it("returns the cached item without hitting the provider when within the TTL", async () => {
    const recentlySynced = {
      gameItem: { id: "g1", lastSyncedAt: new Date() },
    };
    const { service, igdbProvider } = makeService({
      gameExternalId: recentlySynced,
    });

    const result = await service.upsertFromSource("IGDB", "42");

    expect(result).toBe(recentlySynced.gameItem);
    expect(igdbProvider.getDetails).not.toHaveBeenCalled();
  });

  it("refetches from the provider when the cached item is past the TTL", async () => {
    const stale = {
      gameItem: {
        id: "g1",
        lastSyncedAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
      },
    };
    const { service, igdbProvider } = makeService({ gameExternalId: stale });

    await service.upsertFromSource("IGDB", "42");

    expect(igdbProvider.getDetails).toHaveBeenCalledWith("42");
  });

  it("fetches from the provider when there is no cached item", async () => {
    const { service, igdbProvider, prisma } = makeService({
      gameExternalId: null,
    });

    await service.upsertFromSource("IGDB", "42");

    expect(igdbProvider.getDetails).toHaveBeenCalledWith("42");
    expect(prisma.gameItem.create).toHaveBeenCalled();
  });
});

describe("GameItemService.persistDetails", () => {
  it("creates a new game item when no external id reference exists yet", async () => {
    const { service, prisma } = makeService({ gameExternalId: null });

    await service.persistDetails("IGDB", details);

    expect(prisma.gameItem.create).toHaveBeenCalled();
    expect(prisma.gameItem.update).not.toHaveBeenCalled();
  });

  it("refreshes the existing game item when an external id reference exists", async () => {
    const { service, prisma } = makeService({
      gameExternalId: { gameItemId: "existing-1" },
    });

    await service.persistDetails("IGDB", details);

    expect(prisma.gameItem.update).toHaveBeenCalledWith({
      where: { id: "existing-1" },
      data: expect.any(Object),
    });
    expect(prisma.gameItem.create).not.toHaveBeenCalled();
  });

  it("throws when the provider details carry no id for the given source", async () => {
    const { service } = makeService({});

    await expect(
      service.persistDetails("IGDB", {
        ...details,
        externalIds: [],
      }),
    ).rejects.toThrow("Provider details for IGDB carry no IGDB id");
  });
});

describe("GameItemService time to beat", () => {
  it("stores IGDB's times to beat in their own columns", async () => {
    const { service, prisma } = makeService({ gameExternalId: null });

    await service.persistDetails("IGDB", {
      ...details,
      timeToBeat: {
        hastilyMin: 1560,
        normallyMin: 2460,
        completelyMin: null,
        submissions: 152,
      },
    });

    const [[call]] = (prisma.gameItem.create as Mock).mock.calls;
    expect(call.data).toMatchObject({
      timeToBeatHastilyMin: 1560,
      timeToBeatNormallyMin: 2460,
      timeToBeatCompletelyMin: null,
      timeToBeatSubmissions: 152,
    });
  });

  it("clears the stored times when IGDB no longer has enough submissions", async () => {
    const { service, prisma } = makeService({
      gameExternalId: { gameItemId: "existing-1" },
    });

    await service.persistDetails("IGDB", { ...details, timeToBeat: null });

    const [[call]] = (prisma.gameItem.update as Mock).mock.calls;
    expect(call.data).toMatchObject({
      timeToBeatHastilyMin: null,
      timeToBeatNormallyMin: null,
      timeToBeatCompletelyMin: null,
      timeToBeatSubmissions: null,
    });
  });
});

describe("GameItemService.refreshStale", () => {
  const staleItem = (id: string, igdbId: string) => ({
    id,
    canonicalSource: "IGDB",
    externalIds: [{ source: "IGDB", externalId: igdbId }],
  });

  it("fetches every stale game in one batched provider call", async () => {
    const getDetailsByIds = vi.fn().mockResolvedValue([details, details]);
    const { service, igdbProvider } = makeService({
      gameExternalId: { gameItemId: "existing-1" },
      staleItems: [staleItem("g1", "42"), staleItem("g2", "43")],
      getDetailsByIds,
    });

    const refreshed = await service.refreshStale();

    expect(getDetailsByIds).toHaveBeenCalledTimes(1);
    expect(getDetailsByIds).toHaveBeenCalledWith(["42", "43"]);
    expect(igdbProvider.getDetails).not.toHaveBeenCalled();
    expect(refreshed).toBe(2);
  });

  it("only looks at tracked, non-dropped games past the TTL", async () => {
    const { service, prisma } = makeService({});

    await service.refreshStale();

    const [[query]] = (prisma.gameItem.findMany as Mock).mock.calls;
    expect(query.where.entries).toEqual({
      some: { status: { not: "DROPPED" } },
    });
    expect(query.where.lastSyncedAt.lt.getTime()).toBeLessThan(
      Date.now() - 23 * 60 * 60 * 1000,
    );
  });

  it("keeps going when one game fails to persist", async () => {
    const { service, prisma } = makeService({
      gameExternalId: { gameItemId: "existing-1" },
      staleItems: [staleItem("g1", "42"), staleItem("g2", "43")],
      getDetailsByIds: vi.fn().mockResolvedValue([details, details]),
    });
    (prisma.gameItem.update as Mock)
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce({ id: "updated" });

    expect(await service.refreshStale()).toBe(1);
  });

  it("calls nothing when no game is stale", async () => {
    const getDetailsByIds = vi.fn();
    const { service } = makeService({ getDetailsByIds });

    expect(await service.refreshStale()).toBe(0);
    expect(getDetailsByIds).not.toHaveBeenCalled();
  });
});
