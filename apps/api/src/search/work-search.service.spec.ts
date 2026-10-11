import type {
  Domain,
  MediaSummaryDto,
  MusicSummaryDto,
} from "@loomkeep/shared";
import type { Prisma } from "@prisma/client";
import { vi } from "vitest";
import type { BookItemService } from "../books/book-item.service";
import type { MediaItemService } from "../catalog/media-item.service";
import type { GameItemService } from "../games/game-item.service";
import type { MusicItemService } from "../music/music-item.service";
import type { PrismaService } from "../prisma/prisma.service";
import type { AgeGateService } from "../users/age-gate.service";
import type { DomainGateService } from "../users/domain-gate.service";
import { WorkSearchService } from "./work-search.service";

const DUNE: MediaSummaryDto = {
  source: "TMDB",
  sourceId: "438631",
  type: "MOVIE",
  title: "Dune",
  year: 2021,
  posterUrl: null,
  isAdult: false,
};

const ALBUM: MusicSummaryDto = {
  source: "MUSICBRAINZ",
  sourceId: "0f9c1d6e",
  title: "Dune (Original Motion Picture Soundtrack)",
  artists: ["Hans Zimmer"],
  year: 2021,
  coverUrl: null,
};

/** Which item table a raw query reads, from its interpolated fragments. */
const readsTable = (values: unknown[], table: string) =>
  values.some((value) => (value as Prisma.Sql)?.sql?.includes(`"${table}"`));

function setup({
  domains = ["MEDIA", "MUSIC"] as Domain[],
  localMedia = [] as object[],
  mediaStatuses = [] as object[],
} = {}) {
  const queryRaw = vi.fn(
    async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const sql = strings.join("");
      if (!readsTable(values, "MediaItem")) return [];
      return sql.includes("LIMIT") ? localMedia : mediaStatuses;
    },
  );
  const tmdb = { search: vi.fn(async () => [DUNE]) };
  const anilist = { search: vi.fn(async () => []) };
  const media = {
    providerFor: (source: string) => (source === "TMDB" ? tmdb : anilist),
  } as unknown as MediaItemService;
  const music = { search: vi.fn(async () => [ALBUM]) };
  const books = { search: vi.fn(async () => []) };

  const service = new WorkSearchService(
    { $queryRaw: queryRaw } as unknown as PrismaService,
    {
      getEnabledDomains: async () => domains,
    } as unknown as DomainGateService,
    { allowsAdultContent: async () => false } as unknown as AgeGateService,
    media,
    {} as GameItemService,
    books as unknown as BookItemService,
    music as unknown as MusicItemService,
  );

  return { service, tmdb, music, books };
}

describe("WorkSearchService", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("mixes the domains' catalogues, best match first", async () => {
    const { service } = setup();

    const result = await service.search("u1", "dune", { catalogs: true });

    expect(result.items.map((hit) => hit.href)).toEqual([
      "/app/media/movie/438631",
      "/app/music/0f9c1d6e",
    ]);
    expect(result.unavailable).toEqual([]);
  });

  it("asks a catalogue once for the same query typed again", async () => {
    const { service, tmdb } = setup();

    await service.search("u1", "Dune", { catalogs: true });
    await service.search("u2", "dune ", { catalogs: true });

    expect(tmdb.search).toHaveBeenCalledTimes(1);
  });

  it("answers without a slow catalogue, then with its late answer", async () => {
    vi.useFakeTimers();
    const { service, music } = setup();
    music.search.mockImplementationOnce(
      () => new Promise((resolve) => setTimeout(() => resolve([ALBUM]), 4_000)),
    );

    const first = service.search("u1", "dune", { catalogs: true });
    await vi.advanceTimersByTimeAsync(2_500);
    expect((await first).unavailable).toEqual(["MUSIC"]);
    expect((await first).items.map((hit) => hit.kind)).toEqual(["MOVIE"]);

    await vi.advanceTimersByTimeAsync(2_000);
    const second = await service.search("u1", "dune", { catalogs: true });

    expect(second.items.map((hit) => hit.kind)).toContain("MUSIC");
    expect(music.search).toHaveBeenCalledTimes(1);
  });

  it("shows a work known to the instance once, with the viewer's status", async () => {
    const { service } = setup({
      localMedia: [
        {
          source: "TMDB",
          sourceId: "438631",
          kind: "MOVIE",
          title: "Dune",
          imageUrl: null,
          year: 2021,
          isAdult: false,
          trackers: 4,
        },
      ],
      mediaStatuses: [
        {
          source: "TMDB",
          sourceId: "438631",
          kind: "MOVIE",
          status: "COMPLETED",
        },
      ],
    });

    const result = await service.search("u1", "dune", { catalogs: true });

    expect(
      result.items.filter((hit) => hit.href === "/app/media/movie/438631"),
    ).toEqual([expect.objectContaining({ status: "COMPLETED" })]);
  });

  it("asks no catalogue for the instance's works only", async () => {
    const { service, tmdb, music } = setup();

    await service.search("u1", "dune", { catalogs: false });

    expect(tmdb.search).not.toHaveBeenCalled();
    expect(music.search).not.toHaveBeenCalled();
  });

  it("asks only the books for an ISBN", async () => {
    const { service, tmdb, books } = setup({ domains: ["MEDIA", "BOOKS"] });

    await service.search("u1", "978-2-07-036024-5", { catalogs: true });

    expect(tmdb.search).not.toHaveBeenCalled();
    expect(books.search).toHaveBeenCalledWith("isbn:9782070360245", undefined);
  });
});
