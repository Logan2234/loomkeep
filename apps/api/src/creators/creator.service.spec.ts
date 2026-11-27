import { ErrorCode } from "@loomkeep/shared/catalog";
import type { CreatorWorkDto, PersonPageDto } from "@loomkeep/shared/contracts";
import { CreatorCreditKind } from "@loomkeep/shared/contracts";
import { MediaType } from "@loomkeep/shared/enums";
import { vi } from "vitest";
import type { BookSagaService } from "../books/book-saga.service";
import type { OpenLibraryProvider } from "../books/providers/open-library.provider";
import type { MediaProgressService } from "../media/media-progress.service";
import type { TmdbProvider } from "../media/providers/tmdb.provider";
import type { AgeGateService } from "../users/age-gate.service";
import { CreatorService } from "./creator.service";

function work(overrides: Partial<CreatorWorkDto>): CreatorWorkDto {
  return {
    domain: "MEDIA",
    type: MediaType.MOVIE,
    sourceId: "1",
    title: "Work",
    year: 2020,
    releaseDate: "2020-01-01",
    posterUrl: null,
    isAdult: false,
    jobs: [],
    character: null,
    episodeCount: null,
    genreIds: [],
    upcoming: false,
    kind: CreatorCreditKind.WORK,
    editionCount: null,
    series: null,
    status: null,
    ...overrides,
  };
}

function page(works: CreatorWorkDto[]): PersonPageDto {
  return {
    source: "tmdb",
    id: "137427",
    name: "Denis Villeneuve",
    photoUrl: null,
    description: null,
    birthday: null,
    deathday: null,
    placeOfBirth: null,
    knownFor: "DIRECTING",
    alsoKnownAs: [],
    imdbId: null,
    wikidataId: null,
    homepage: null,
    groups: [{ key: "DIRECTING", works }],
    rareCount: 0,
  };
}

function setup(person: PersonPageDto, allowAdult = false) {
  const tmdb = {
    getPersonPage: vi.fn().mockResolvedValue(person),
    getStudioPage: vi.fn().mockResolvedValue({
      kind: "NETWORK",
      id: "49",
      name: "HBO",
      knownFor: [work({ type: MediaType.SERIES, sourceId: "438631" })],
    }),
    getStudioWorks: vi.fn().mockResolvedValue({
      items: [work({ sourceId: "438631" }), work({ sourceId: "7" })],
      hasMore: true,
      total: 177,
    }),
  };
  const library = {
    statusesBySourceId: vi.fn(
      async (_user: string, _source: string, type: MediaType) =>
        new Map(
          type === MediaType.MOVIE
            ? [["438631", "COMPLETED"]]
            : [["438631", "WATCHING"]],
        ),
    ),
  };
  const ageGate = { allowsAdultContent: vi.fn().mockResolvedValue(allowAdult) };
  const openLibrary = { getAuthorPage: vi.fn().mockResolvedValue(person) };
  const bookSagas = {
    statusesBySourceId: vi
      .fn()
      .mockResolvedValue(new Map([["OL45804W", "READ"]])),
  };
  const service = new CreatorService(
    tmdb as unknown as TmdbProvider,
    openLibrary as unknown as OpenLibraryProvider,
    library as unknown as MediaProgressService,
    bookSagas as unknown as BookSagaService,
    ageGate as unknown as AgeGateService,
  );
  return { service, tmdb, library, openLibrary, bookSagas };
}

describe("CreatorService.getPerson", () => {
  it("reads films and series statuses separately: their TMDB ids overlap", async () => {
    const { service, library } = setup(
      page([
        work({ type: MediaType.MOVIE, sourceId: "438631" }),
        work({ type: MediaType.SERIES, sourceId: "438631" }),
        work({ type: MediaType.MOVIE, sourceId: "7" }),
      ]),
    );

    const result = await service.getPerson("u1", "tmdb", "137427", "fr");

    expect(result.groups[0].works.map((w) => [w.type, w.status])).toEqual([
      [MediaType.MOVIE, "COMPLETED"],
      [MediaType.SERIES, "WATCHING"],
      [MediaType.MOVIE, null],
    ]);
    expect(library.statusesBySourceId).toHaveBeenCalledWith(
      "u1",
      "TMDB",
      MediaType.MOVIE,
      ["438631", "7"],
    );
    expect(library.statusesBySourceId).toHaveBeenCalledWith(
      "u1",
      "TMDB",
      MediaType.SERIES,
      ["438631"],
    );
  });

  it("leaves adult works out, and a group emptied by it, unless the account allows them", async () => {
    const person = page([work({ sourceId: "9", isAdult: true })]);

    const hidden = await setup(person).service.getPerson("u1", "tmdb", "1");
    const shown = await setup(person, true).service.getPerson(
      "u1",
      "tmdb",
      "1",
    );

    expect(hidden.groups).toEqual([]);
    expect(shown.groups[0].works).toHaveLength(1);
  });

  it("caches the page per language but never the viewer's statuses", async () => {
    const { service, tmdb, library } = setup(
      page([work({ sourceId: "438631" })]),
    );

    const first = await service.getPerson("u1", "tmdb", "137427", "fr");
    library.statusesBySourceId.mockResolvedValue(new Map());
    const second = await service.getPerson("u2", "tmdb", "137427", "fr");
    await service.getPerson("u1", "tmdb", "137427", "en");

    expect(first.groups[0].works[0].status).toBe("COMPLETED");
    expect(second.groups[0].works[0].status).toBeNull();
    expect(tmdb.getPersonPage).toHaveBeenCalledTimes(2);
  });

  it("reads an Open Library author's books with the viewer's reading statuses", async () => {
    const author = {
      ...page([
        work({ domain: "BOOKS", type: null, sourceId: "OL45804W" }),
        work({ domain: "BOOKS", type: null, sourceId: "OL45805W" }),
      ]),
      source: "openlibrary" as const,
    };
    const { service, openLibrary, bookSagas, tmdb } = setup(author);

    const result = await service.getPerson(
      "u1",
      "openlibrary",
      "OL25712A",
      "fr",
    );

    expect(openLibrary.getAuthorPage).toHaveBeenCalledWith("OL25712A", "fr");
    expect(tmdb.getPersonPage).not.toHaveBeenCalled();
    expect(bookSagas.statusesBySourceId).toHaveBeenCalledWith("u1", [
      "OL45804W",
      "OL45805W",
    ]);
    expect(result.groups[0].works.map((w) => w.status)).toEqual(["READ", null]);
  });

  it("has no person page for AniList or IGDB yet", async () => {
    const { service } = setup(page([]));

    await expect(
      service.getPerson("u1", "anilist", "95185"),
    ).rejects.toMatchObject({ code: ErrorCode.CatalogNoPersonDetails });
  });

  it("adds the viewer's statuses to a studio's page of works, cached per page", async () => {
    const { service, tmdb } = setup(page([]));
    const query = { type: MediaType.MOVIE, order: "known" as const, page: 1 };

    const result = await service.getStudioWorks(
      "u1",
      "tmdb",
      "COMPANY",
      "41077",
      query,
      "fr",
    );
    await service.getStudioWorks("u2", "tmdb", "COMPANY", "41077", query, "fr");
    await service.getStudioWorks(
      "u1",
      "tmdb",
      "COMPANY",
      "41077",
      { ...query, page: 2 },
      "fr",
    );

    expect(result).toMatchObject({ hasMore: true, total: 177 });
    expect(result.items.map((w) => w.status)).toEqual(["COMPLETED", null]);
    expect(tmdb.getStudioWorks).toHaveBeenCalledTimes(2);
  });

  it("gives a studio's best-known titles the viewer's statuses, and only from TMDB", async () => {
    const { service } = setup(page([]));

    const hbo = await service.getStudio("u1", "tmdb", "NETWORK", "49", "fr");

    expect(hbo.knownFor.map((w) => w.status)).toEqual(["WATCHING"]);
    await expect(
      service.getStudio("u1", "anilist", "COMPANY", "21"),
    ).rejects.toMatchObject({ code: ErrorCode.CatalogNoPersonDetails });
  });
});
