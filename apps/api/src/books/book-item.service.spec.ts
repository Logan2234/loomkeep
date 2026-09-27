import { vi, type Mock } from "vitest";
import type { JobRunService } from "../jobs/job-run.service";
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

const jobRunsStub = {
  record: (_key: string, fn: () => Promise<unknown>) => fn(),
} as unknown as JobRunService;

function makeService(overrides: {
  bookExternalId?: unknown;
  getDetails?: Mock;
  staleItems?: { id: string }[];
}) {
  const prisma = {
    bookExternalId: {
      findUnique: vi.fn().mockResolvedValue(overrides.bookExternalId ?? null),
      upsert: vi.fn(),
    },
    bookItem: {
      create: vi.fn().mockResolvedValue({ id: "created" }),
      update: vi.fn().mockResolvedValue({ id: "updated" }),
      findMany: vi.fn().mockResolvedValue(overrides.staleItems ?? []),
      findUniqueOrThrow: vi.fn(
        async ({ where }: { where: { id: string } }) => ({
          id: where.id,
          canonicalSource: "OPEN_LIBRARY",
          externalIds: [
            { source: "OPEN_LIBRARY", externalId: `OL-${where.id}` },
          ],
        }),
      ),
    },
  } as unknown as PrismaService;
  const openLibraryProvider = {
    getDetails: overrides.getDetails ?? vi.fn().mockResolvedValue(details),
  } as unknown as OpenLibraryProvider;
  const service = new BookItemService(prisma, openLibraryProvider, jobRunsStub);
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

describe("BookItemService.refreshStale", () => {
  it("refetches every tracked book older than a week, dropped ones included", async () => {
    const { service, prisma, openLibraryProvider } = makeService({
      bookExternalId: { bookItemId: "b1" },
      staleItems: [{ id: "b1" }, { id: "b2" }],
    });

    expect(await service.refreshStale()).toBe(2);

    const [[query]] = (prisma.bookItem.findMany as Mock).mock.calls;
    expect(query.where.entries).toEqual({ some: {} });
    expect(query.where.lastSyncedAt.lt.getTime()).toBeLessThan(
      Date.now() - 6 * 24 * 60 * 60 * 1000,
    );
    expect(openLibraryProvider.getDetails).toHaveBeenCalledWith("OL-b1");
    expect(openLibraryProvider.getDetails).toHaveBeenCalledWith("OL-b2");
  });

  it("stores the picked edition's ISBN on refresh", async () => {
    const { service, prisma } = makeService({
      bookExternalId: { bookItemId: "b1" },
      staleItems: [{ id: "b1" }],
      getDetails: vi
        .fn()
        .mockResolvedValue({ ...details, isbn: "9780261102217" }),
    });

    await service.refreshStale();

    expect(prisma.bookItem.update).toHaveBeenCalledWith({
      where: { id: "b1" },
      data: expect.objectContaining({ isbn: "9780261102217" }),
    });
  });

  it("keeps going when one book fails to refresh", async () => {
    const { service } = makeService({
      bookExternalId: { bookItemId: "b1" },
      staleItems: [{ id: "b1" }, { id: "b2" }],
      getDetails: vi
        .fn()
        .mockRejectedValueOnce(new Error("boom"))
        .mockResolvedValueOnce(details),
    });

    expect(await service.refreshStale()).toBe(1);
  });
});
