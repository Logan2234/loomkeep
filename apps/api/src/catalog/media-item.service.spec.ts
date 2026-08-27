import type { JobRunService } from "../jobs/job-run.service";
import type { PrismaService } from "../prisma/prisma.service";
import { MediaItemService } from "./media-item.service";

// Runs `fn` straight through without touching the DB — refreshStale's own
// behaviour is what's under test here, not the job-recording wrapper.
const jobRunsStub = {
  record: (_key: string, fn: () => Promise<unknown>) => fn(),
} as unknown as JobRunService;

describe("MediaItemService.refreshStale", () => {
  function makeService(items: unknown[]) {
    const prisma = {
      mediaItem: { findMany: jest.fn().mockResolvedValue(items) },
    } as unknown as PrismaService;
    const service = new MediaItemService(
      prisma,
      undefined as never,
      undefined as never,
      jobRunsStub,
    );
    return { service, prisma };
  }

  it("only queries non-dropped tracked media past the sync TTL", async () => {
    const { service, prisma } = makeService([]);
    await service.refreshStale();
    expect(prisma.mediaItem.findMany).toHaveBeenCalledWith({
      where: {
        lastSyncedAt: { lt: expect.any(Date) },
        entries: { some: { status: { not: "DROPPED" } } },
      },
      include: { externalIds: true },
    });
  });

  it("re-syncs each stale item via its canonical external id", async () => {
    const items = [
      {
        id: "m1",
        type: "SERIES",
        canonicalSource: "TMDB",
        externalIds: [{ source: "TMDB", externalId: "42" }],
      },
      {
        id: "m2",
        type: "ANIME",
        canonicalSource: "ANILIST",
        externalIds: [{ source: "ANILIST", externalId: "99" }],
      },
    ];
    const { service } = makeService(items);
    const upsert = jest
      .spyOn(service, "upsertFromSource")
      .mockResolvedValue(undefined as never);

    const refreshed = await service.refreshStale();

    expect(refreshed).toBe(2);
    expect(upsert).toHaveBeenNthCalledWith(1, "TMDB", "42", "SERIES");
    expect(upsert).toHaveBeenNthCalledWith(2, "ANILIST", "99", "ANIME");
  });

  it("skips items missing their canonical external id", async () => {
    const items = [{ id: "m1", canonicalSource: "TMDB", externalIds: [] }];
    const { service } = makeService(items);
    const upsert = jest.spyOn(service, "upsertFromSource");

    const refreshed = await service.refreshStale();

    expect(refreshed).toBe(0);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("keeps refreshing the rest of the batch when one item fails", async () => {
    const items = [
      {
        id: "m1",
        canonicalSource: "TMDB",
        externalIds: [{ source: "TMDB", externalId: "1" }],
      },
      {
        id: "m2",
        canonicalSource: "TMDB",
        externalIds: [{ source: "TMDB", externalId: "2" }],
      },
    ];
    const { service } = makeService(items);
    jest.spyOn(service["logger"], "error").mockImplementation(() => undefined);
    const upsert = jest
      .spyOn(service, "upsertFromSource")
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce(undefined as never);

    const refreshed = await service.refreshStale();

    expect(refreshed).toBe(1);
    expect(upsert).toHaveBeenCalledTimes(2);
  });
});

const PROVIDER_DETAILS = {
  summary: {
    source: "TMDB",
    sourceId: "42",
    type: "MOVIE",
    title: "Le Titre",
    posterUrl: null,
    isAdult: false,
  },
  overview: "Le résumé.",
  backdropUrl: null,
  genres: ["Horreur"],
  status: "Released",
  releaseDate: "2020-01-01",
  runtimeMin: 100,
  externalIds: [],
  seasons: [],
};

describe("MediaItemService.translationFor", () => {
  function makeService(overrides: {
    findUnique?: jest.Mock;
    upsert?: jest.Mock;
    getDetails?: jest.Mock;
  }) {
    const prisma = {
      mediaItemTranslation: {
        findUnique: overrides.findUnique ?? jest.fn().mockResolvedValue(null),
        upsert: overrides.upsert ?? jest.fn(),
      },
    } as unknown as PrismaService;
    const tmdbProvider = {
      getDetails: overrides.getDetails ?? jest.fn(),
    };
    const service = new MediaItemService(
      prisma,
      tmdbProvider as never,
      undefined as never,
      jobRunsStub,
    );
    return { service, prisma, tmdbProvider };
  }

  it("skips the DB and provider entirely for the default (English) locale", async () => {
    const { service, prisma, tmdbProvider } = makeService({});

    const result = await service.translationFor(
      "m1",
      "TMDB",
      "42",
      "MOVIE",
      "en",
    );

    expect(result).toBeNull();
    expect(prisma.mediaItemTranslation.findUnique).not.toHaveBeenCalled();
    expect(tmdbProvider.getDetails).not.toHaveBeenCalled();
  });

  it("skips the DB and provider entirely for AniList (no localization support)", async () => {
    const { service, prisma, tmdbProvider } = makeService({});

    const result = await service.translationFor(
      "m1",
      "ANILIST",
      "154587",
      "ANIME",
      "fr",
    );

    expect(result).toBeNull();
    expect(prisma.mediaItemTranslation.findUnique).not.toHaveBeenCalled();
    expect(tmdbProvider.getDetails).not.toHaveBeenCalled();
  });

  it("returns an existing translation without calling the provider", async () => {
    const existing = { title: "Le Titre", overview: "Résumé", genres: [] };
    const { service, tmdbProvider } = makeService({
      findUnique: jest.fn().mockResolvedValue(existing),
    });

    const result = await service.translationFor(
      "m1",
      "TMDB",
      "42",
      "MOVIE",
      "fr",
    );

    expect(result).toBe(existing);
    expect(tmdbProvider.getDetails).not.toHaveBeenCalled();
  });

  it("fetches live and persists a new translation when none exists yet", async () => {
    const upsert = jest.fn().mockResolvedValue({
      title: "Le Titre",
      overview: "Le résumé.",
      genres: ["Horreur"],
    });
    const { service, tmdbProvider } = makeService({
      getDetails: jest.fn().mockResolvedValue(PROVIDER_DETAILS),
      upsert,
    });

    const result = await service.translationFor(
      "m1",
      "TMDB",
      "42",
      "MOVIE",
      "fr",
    );

    expect(tmdbProvider.getDetails).toHaveBeenCalledWith("42", "MOVIE", "fr");
    expect(upsert).toHaveBeenCalledWith({
      where: { mediaItemId_locale: { mediaItemId: "m1", locale: "fr" } },
      update: {
        title: "Le Titre",
        overview: "Le résumé.",
        genres: ["Horreur"],
      },
      create: {
        mediaItemId: "m1",
        locale: "fr",
        title: "Le Titre",
        overview: "Le résumé.",
        genres: ["Horreur"],
      },
    });
    expect(result?.title).toBe("Le Titre");
  });
});

describe("MediaItemService.translatedTitles", () => {
  it("skips the DB for the default locale or an empty id list", async () => {
    const findMany = jest.fn();
    const prisma = {
      mediaItemTranslation: { findMany },
    } as unknown as PrismaService;
    const service = new MediaItemService(
      prisma,
      undefined as never,
      undefined as never,
      jobRunsStub,
    );

    expect(await service.translatedTitles(["m1"], "en")).toEqual(new Map());
    expect(await service.translatedTitles([], "fr")).toEqual(new Map());
    expect(findMany).not.toHaveBeenCalled();
  });

  it("maps cached titles by media item id", async () => {
    const prisma = {
      mediaItemTranslation: {
        findMany: jest.fn().mockResolvedValue([
          { mediaItemId: "m1", title: "Le Titre" },
          { mediaItemId: "m2", title: "Un Autre" },
        ]),
      },
    } as unknown as PrismaService;
    const service = new MediaItemService(
      prisma,
      undefined as never,
      undefined as never,
      jobRunsStub,
    );

    const titles = await service.translatedTitles(["m1", "m2", "m3"], "fr");

    expect(titles.get("m1")).toBe("Le Titre");
    expect(titles.get("m2")).toBe("Un Autre");
    expect(titles.has("m3")).toBe(false);
  });
});

describe("MediaItemService.forceRefresh (translation refresh)", () => {
  it("refreshes every existing translation on the same cycle as the base row", async () => {
    const getDetails = jest
      .fn()
      .mockResolvedValueOnce(PROVIDER_DETAILS) // base (English) refresh
      .mockResolvedValueOnce({
        ...PROVIDER_DETAILS,
        summary: { ...PROVIDER_DETAILS.summary, title: "Le Titre FR" },
      }); // fr translation refresh
    const translationUpdate = jest.fn();
    const prisma = {
      mediaItem: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: "m1",
          type: "MOVIE",
          canonicalSource: "TMDB",
          externalIds: [{ source: "TMDB", externalId: "42" }],
        }),
        update: jest.fn().mockResolvedValue({ id: "m1" }),
      },
      mediaExternalId: { upsert: jest.fn() },
      mediaItemTranslation: {
        findMany: jest.fn().mockResolvedValue([{ locale: "fr" }]),
        update: translationUpdate,
      },
    } as unknown as PrismaService;
    const tmdbProvider = { getDetails };
    const service = new MediaItemService(
      prisma,
      tmdbProvider as never,
      undefined as never,
      jobRunsStub,
    );

    await service.forceRefresh("m1");

    expect(getDetails).toHaveBeenNthCalledWith(1, "42", "MOVIE");
    expect(getDetails).toHaveBeenNthCalledWith(2, "42", "MOVIE", "fr");
    expect(translationUpdate).toHaveBeenCalledWith({
      where: { mediaItemId_locale: { mediaItemId: "m1", locale: "fr" } },
      data: {
        title: "Le Titre FR",
        overview: "Le résumé.",
        genres: ["Horreur"],
      },
    });
  });

  it("logs and keeps going when a translation refresh fails", async () => {
    const getDetails = jest
      .fn()
      .mockResolvedValueOnce(PROVIDER_DETAILS)
      .mockRejectedValueOnce(new Error("boom"));
    const prisma = {
      mediaItem: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: "m1",
          type: "MOVIE",
          canonicalSource: "TMDB",
          externalIds: [{ source: "TMDB", externalId: "42" }],
        }),
        update: jest.fn().mockResolvedValue({ id: "m1" }),
      },
      mediaExternalId: { upsert: jest.fn() },
      mediaItemTranslation: {
        findMany: jest.fn().mockResolvedValue([{ locale: "fr" }]),
        update: jest.fn(),
      },
    } as unknown as PrismaService;
    const service = new MediaItemService(
      prisma,
      { getDetails } as never,
      undefined as never,
      jobRunsStub,
    );
    jest.spyOn(service["logger"], "error").mockImplementation(() => undefined);

    await expect(service.forceRefresh("m1")).resolves.toEqual({ id: "m1" });
  });
});
