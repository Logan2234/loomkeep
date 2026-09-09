import { CatalogSource, MediaType } from "@loomkeep/shared";
import { vi } from "vitest";
import { AnilistMatchResolver } from "./anilist-match-resolver";
import { MyAnimeListImportSource } from "./myanimelist.source";
import { parseMyAnimeListXml } from "./parse-myanimelist-xml";

const EXPORT = `<?xml version="1.0" encoding="UTF-8"?>
<myanimelist>
  <myinfo><user_export_type>1</user_export_type></myinfo>
  <anime>
    <series_animedb_id>136</series_animedb_id>
    <series_title><![CDATA[Hunter x Hunter]]></series_title>
    <series_type>TV</series_type>
    <series_episodes>62</series_episodes>
    <my_watched_episodes>1</my_watched_episodes>
    <my_start_date>2026-01-10</my_start_date>
    <my_finish_date>0000-00-00</my_finish_date>
    <my_score>0</my_score>
    <my_storage>NAS</my_storage>
    <my_status>On-Hold</my_status>
    <my_comments><![CDATA[]]></my_comments>
  </anime>
  <anime>
    <series_animedb_id>19951</series_animedb_id>
    <series_title>Hunter x Hunter Movie 2: The Last Mission</series_title>
    <series_type>Movie</series_type>
    <series_episodes>1</series_episodes>
    <my_watched_episodes>1</my_watched_episodes>
    <my_start_date>0000-00-00</my_start_date>
    <my_finish_date>0000-00-00</my_finish_date>
    <my_score>4</my_score>
    <my_storage>VHS</my_storage>
    <my_status>Watching</my_status>
    <my_comments><![CDATA[]]></my_comments>
  </anime>
  <anime>
    <series_animedb_id>52991</series_animedb_id>
    <series_title>Sousou no Frieren</series_title>
    <series_type>TV</series_type>
    <series_episodes>28</series_episodes>
    <my_watched_episodes>3</my_watched_episodes>
    <my_start_date>2021-06-05</my_start_date>
    <my_finish_date>2026-07-04</my_finish_date>
    <my_score>0</my_score>
    <my_storage>Blu-ray</my_storage>
    <my_status>Dropped</my_status>
    <my_comments><![CDATA[A private note\nwith two lines]]></my_comments>
  </anime>
</myanimelist>`;

function makeSource() {
  const prisma = {
    season: {
      findMany: vi.fn().mockResolvedValue([
        {
          number: 1,
          episodes: [
            { id: "episode-1", number: 1 },
            { id: "episode-2", number: 2 },
            { id: "episode-3", number: 3 },
          ],
        },
      ]),
    },
    episodeWatch: {
      count: vi.fn().mockResolvedValue(0),
      createMany: vi.fn(),
    },
    mediaExternalId: {
      findUnique: vi.fn().mockResolvedValue({ mediaItemId: "media-1" }),
    },
    libraryEntry: { upsert: vi.fn() },
  };
  const mediaItemService = {
    upsertFromSource: vi.fn().mockResolvedValue({ id: "media-1" }),
  };
  const anilist = {
    getSummaryByMalId: vi.fn().mockImplementation(async (id: string) => ({
      source: CatalogSource.ANILIST,
      sourceId: `anilist-${id}`,
      type: MediaType.ANIME,
      title: `AniList ${id}`,
      year: 2026,
      posterUrl: null,
    })),
  };
  const reviews = { setRating: vi.fn() };
  const source = new MyAnimeListImportSource(
    prisma as never,
    mediaItemService as never,
    new AnilistMatchResolver(anilist as never),
    reviews as never,
  );
  return { source, prisma, mediaItemService, anilist, reviews };
}

describe("MyAnimeList import", () => {
  it("maps MAL statuses, dates, ownership and notes without inventing episode dates", () => {
    const parsed = parseMyAnimeListXml(EXPORT);

    expect(parsed.movies).toEqual([]);
    expect(parsed.shows[0]).toMatchObject({
      status: "WATCHING",
      startedAt: new Date("2026-01-10T00:00:00.000Z"),
      finishedAt: null,
      ownershipStatus: "DIGITAL",
      ownershipSource: "NAS",
    });
    expect(parsed.shows[0].episodes[0].watchedAt).toBeNull();
    expect(parsed.shows[1]).toMatchObject({
      status: "COMPLETED",
      rating: 4,
      ownershipStatus: "PHYSICAL",
      ownershipSource: null,
    });
    expect(parsed.shows[2]).toMatchObject({
      status: "DROPPED",
      startedAt: null,
      finishedAt: null,
      notes: "A private note\nwith two lines",
      ownershipStatus: "PHYSICAL",
    });
  });

  it("rejects a manga export", () => {
    expect(() =>
      parseMyAnimeListXml(
        EXPORT.replace(
          "<user_export_type>1</user_export_type>",
          "<user_export_type>2</user_export_type>",
        ),
      ),
    ).toThrow(/anime exports/i);
  });

  it("resolves and writes only through AniList, keeping imported episode dates null", async () => {
    const { source, prisma, mediaItemService, anilist, reviews } = makeSource();
    const parsed = source.parseInput(EXPORT);
    const progress = { setTotal: vi.fn(), tick: vi.fn() };
    const plan = await source.buildPlan("u1", parsed, progress);

    expect(anilist.getSummaryByMalId).toHaveBeenCalledWith("136");
    expect(plan.searchMediaType).toBe(MediaType.ANIME);
    expect(plan.groups.flatMap((group) => group.items)).toHaveLength(3);

    await source.commit(
      "u1",
      parsed,
      plan,
      {
        include: new Set(["anilist:52991"]),
        statuses: new Map(),
        overrides: new Map(),
        overwrite: false,
      },
      progress,
    );

    expect(mediaItemService.upsertFromSource).toHaveBeenCalledWith(
      CatalogSource.ANILIST,
      "anilist-52991",
      MediaType.ANIME,
    );
    expect(
      prisma.episodeWatch.createMany.mock.calls.map(([args]) => args.data),
    ).toEqual([
      [{ userId: "u1", episodeId: "episode-1", watchedAt: null }],
      [{ userId: "u1", episodeId: "episode-2", watchedAt: null }],
      [{ userId: "u1", episodeId: "episode-3", watchedAt: null }],
    ]);
    expect(prisma.libraryEntry.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          status: "DROPPED",
          notes: "A private note\nwith two lines",
          ownershipStatus: "PHYSICAL",
          ownershipSource: null,
        }),
      }),
    );
    expect(reviews.setRating).not.toHaveBeenCalled();
  });

  it("rejects a manual match outside AniList", async () => {
    const { source, mediaItemService } = makeSource();
    const parsed = source.parseInput(EXPORT);
    const progress = { setTotal: vi.fn(), tick: vi.fn() };
    const plan = await source.buildPlan("u1", parsed, progress);

    await source.commit(
      "u1",
      parsed,
      plan,
      {
        include: new Set(["anilist:136"]),
        statuses: new Map(),
        overrides: new Map([
          [
            "anilist:136",
            {
              source: CatalogSource.TMDB,
              sourceId: "999",
              type: MediaType.SERIES,
            },
          ],
        ]),
        overwrite: false,
      },
      progress,
    );

    expect(mediaItemService.upsertFromSource).not.toHaveBeenCalled();
  });
});
