import { vi, type Mock } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import { MusicItemService } from "./music-item.service";
import type { ProviderMusicDetails } from "./providers/music-provider.types";
import type { MusicBrainzProvider } from "./providers/musicbrainz.provider";

const details: ProviderMusicDetails = {
  summary: {
    source: "MUSICBRAINZ",
    sourceId: "mbid-42",
    title: "Some Album",
    artists: ["Someone"],
    year: 2020,
    coverUrl: null,
  },
  genres: [],
  albumType: null,
  trackCount: null,
  releaseDate: null,
  releaseDatePrecision: null,
  sameArtistAlbums: [],
  tags: [],
  disambiguation: null,
  externalLinks: [],
  label: null,
  catalogNumber: null,
  tracks: [],
  totalDurationMs: null,
  extraCoverImages: [],
  externalIds: [{ source: "MUSICBRAINZ", externalId: "mbid-42" }],
} as unknown as ProviderMusicDetails;

function makeService(overrides: {
  musicExternalId?: unknown;
  getDetails?: Mock;
}) {
  const prisma = {
    musicExternalId: {
      findUnique: vi.fn().mockResolvedValue(overrides.musicExternalId ?? null),
      upsert: vi.fn(),
    },
    musicItem: {
      create: vi.fn().mockResolvedValue({ id: "created" }),
      update: vi.fn().mockResolvedValue({ id: "updated" }),
    },
  } as unknown as PrismaService;
  const musicBrainzProvider = {
    getDetails: overrides.getDetails ?? vi.fn().mockResolvedValue(details),
  } as unknown as MusicBrainzProvider;
  const service = new MusicItemService(prisma, musicBrainzProvider);
  return { service, prisma, musicBrainzProvider };
}

describe("MusicItemService.upsertFromSource", () => {
  it("returns the cached item without hitting the provider when within the TTL", async () => {
    const recentlySynced = {
      musicItem: { id: "m1", lastSyncedAt: new Date() },
    };
    const { service, musicBrainzProvider } = makeService({
      musicExternalId: recentlySynced,
    });

    const result = await service.upsertFromSource("MUSICBRAINZ", "mbid-42");

    expect(result).toBe(recentlySynced.musicItem);
    expect(musicBrainzProvider.getDetails).not.toHaveBeenCalled();
  });

  it("refetches from the provider when the cached item is past the TTL", async () => {
    const stale = {
      musicItem: {
        id: "m1",
        lastSyncedAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
      },
    };
    const { service, musicBrainzProvider } = makeService({
      musicExternalId: stale,
    });

    await service.upsertFromSource("MUSICBRAINZ", "mbid-42");

    expect(musicBrainzProvider.getDetails).toHaveBeenCalledWith("mbid-42");
  });

  it("fetches from the provider when there is no cached item", async () => {
    const { service, musicBrainzProvider, prisma } = makeService({
      musicExternalId: null,
    });

    await service.upsertFromSource("MUSICBRAINZ", "mbid-42");

    expect(musicBrainzProvider.getDetails).toHaveBeenCalledWith("mbid-42");
    expect(prisma.musicItem.create).toHaveBeenCalled();
  });
});

describe("MusicItemService.persistDetails", () => {
  it("creates a new music item when no external id reference exists yet", async () => {
    const { service, prisma } = makeService({ musicExternalId: null });

    await service.persistDetails("MUSICBRAINZ", details);

    expect(prisma.musicItem.create).toHaveBeenCalled();
    expect(prisma.musicItem.update).not.toHaveBeenCalled();
  });

  it("refreshes the existing music item when an external id reference exists", async () => {
    const { service, prisma } = makeService({
      musicExternalId: { musicItemId: "existing-1" },
    });

    await service.persistDetails("MUSICBRAINZ", details);

    expect(prisma.musicItem.update).toHaveBeenCalledWith({
      where: { id: "existing-1" },
      data: expect.any(Object),
    });
    expect(prisma.musicItem.create).not.toHaveBeenCalled();
  });

  it("throws when the provider details carry no id for the given source", async () => {
    const { service } = makeService({});

    await expect(
      service.persistDetails("MUSICBRAINZ", {
        ...details,
        externalIds: [],
      }),
    ).rejects.toThrow(
      "Provider details for MUSICBRAINZ carry no MUSICBRAINZ id",
    );
  });
});
