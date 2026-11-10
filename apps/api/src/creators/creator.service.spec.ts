import type { CreatorWorkDto, PersonPageDto } from "@loomkeep/shared";
import { CreatorCreditKind, ErrorCode, MediaType } from "@loomkeep/shared";
import { vi } from "vitest";
import type { TmdbProvider } from "../catalog/providers/tmdb.provider";
import type { LibraryService } from "../library/library.service";
import type { AgeGateService } from "../users/age-gate.service";
import { CreatorService } from "./creator.service";

function work(overrides: Partial<CreatorWorkDto>): CreatorWorkDto {
  return {
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
  };
}

function setup(person: PersonPageDto, allowAdult = false) {
  const tmdb = { getPersonPage: vi.fn().mockResolvedValue(person) };
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
  const service = new CreatorService(
    tmdb as unknown as TmdbProvider,
    library as unknown as LibraryService,
    ageGate as unknown as AgeGateService,
  );
  return { service, tmdb, library };
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

  it("has no person page for a source other than TMDB yet", async () => {
    const { service } = setup(page([]));

    await expect(
      service.getPerson("u1", "openlibrary", "OL24529A"),
    ).rejects.toMatchObject({ code: ErrorCode.CatalogNoPersonDetails });
  });
});
