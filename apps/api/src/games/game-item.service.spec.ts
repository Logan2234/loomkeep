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
} as unknown as ProviderGameDetails;

function makeService(overrides: {
  gameExternalId?: unknown;
  getDetails?: jest.Mock;
}) {
  const prisma = {
    gameExternalId: {
      findUnique: jest.fn().mockResolvedValue(overrides.gameExternalId ?? null),
      upsert: jest.fn(),
    },
    gameItem: {
      create: jest.fn().mockResolvedValue({ id: "created" }),
      update: jest.fn().mockResolvedValue({ id: "updated" }),
    },
  } as unknown as PrismaService;
  const igdbProvider = {
    getDetails: overrides.getDetails ?? jest.fn().mockResolvedValue(details),
  } as unknown as IgdbProvider;
  const service = new GameItemService(prisma, igdbProvider);
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
