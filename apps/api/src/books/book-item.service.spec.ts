import type { PrismaService } from "../prisma/prisma.service";
import { BookItemService } from "./book-item.service";
import type { ProviderBookDetails } from "./providers/book-provider.types";
import type { OpenLibraryProvider } from "./providers/open-library.provider";

const details: ProviderBookDetails = {
  summary: {
    source: "OPEN_LIBRARY",
    sourceId: "OL42W",
    title: "Some Book",
    authors: ["Someone"],
    year: 2020,
    coverUrl: null,
    isAdult: false,
  },
  overview: null,
  subtitle: null,
  publisher: null,
  genres: [],
  pageCount: null,
  releaseDate: null,
  website: null,
  sameAuthorBooks: [],
  ratings: [],
  externalIds: [{ source: "OPEN_LIBRARY", externalId: "OL42W" }],
} as unknown as ProviderBookDetails;

function makeService(overrides: {
  bookExternalId?: unknown;
  getDetails?: jest.Mock;
}) {
  const prisma = {
    bookExternalId: {
      findUnique: jest.fn().mockResolvedValue(overrides.bookExternalId ?? null),
      upsert: jest.fn(),
    },
    bookItem: {
      create: jest.fn().mockResolvedValue({ id: "created" }),
      update: jest.fn().mockResolvedValue({ id: "updated" }),
    },
  } as unknown as PrismaService;
  const openLibraryProvider = {
    getDetails: overrides.getDetails ?? jest.fn().mockResolvedValue(details),
  } as unknown as OpenLibraryProvider;
  const service = new BookItemService(prisma, openLibraryProvider);
  return { service, prisma, openLibraryProvider };
}

describe("BookItemService.upsertFromSource", () => {
  it("returns the cached item without hitting the provider when within the TTL", async () => {
    const recentlySynced = {
      bookItem: { id: "b1", lastSyncedAt: new Date() },
    };
    const { service, openLibraryProvider } = makeService({
      bookExternalId: recentlySynced,
    });

    const result = await service.upsertFromSource("OPEN_LIBRARY", "OL42W");

    expect(result).toBe(recentlySynced.bookItem);
    expect(openLibraryProvider.getDetails).not.toHaveBeenCalled();
  });

  it("refetches from the provider when the cached item is past the TTL", async () => {
    const stale = {
      bookItem: {
        id: "b1",
        lastSyncedAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
      },
    };
    const { service, openLibraryProvider } = makeService({
      bookExternalId: stale,
    });

    await service.upsertFromSource("OPEN_LIBRARY", "OL42W");

    expect(openLibraryProvider.getDetails).toHaveBeenCalledWith("OL42W");
  });

  it("fetches from the provider when there is no cached item", async () => {
    const { service, openLibraryProvider, prisma } = makeService({
      bookExternalId: null,
    });

    await service.upsertFromSource("OPEN_LIBRARY", "OL42W");

    expect(openLibraryProvider.getDetails).toHaveBeenCalledWith("OL42W");
    expect(prisma.bookItem.create).toHaveBeenCalled();
  });
});

describe("BookItemService.persistDetails", () => {
  it("creates a new book item when no external id reference exists yet", async () => {
    const { service, prisma } = makeService({ bookExternalId: null });

    await service.persistDetails("OPEN_LIBRARY", details);

    expect(prisma.bookItem.create).toHaveBeenCalled();
    expect(prisma.bookItem.update).not.toHaveBeenCalled();
  });

  it("refreshes the existing book item when an external id reference exists", async () => {
    const { service, prisma } = makeService({
      bookExternalId: { bookItemId: "existing-1" },
    });

    await service.persistDetails("OPEN_LIBRARY", details);

    expect(prisma.bookItem.update).toHaveBeenCalledWith({
      where: { id: "existing-1" },
      data: expect.any(Object),
    });
    expect(prisma.bookItem.create).not.toHaveBeenCalled();
  });

  it("throws when the provider details carry no id for the given source", async () => {
    const { service } = makeService({});

    await expect(
      service.persistDetails("OPEN_LIBRARY", {
        ...details,
        externalIds: [],
      }),
    ).rejects.toThrow(
      "Provider details for OPEN_LIBRARY carry no OPEN_LIBRARY id",
    );
  });
});
