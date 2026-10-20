import { CatalogSource, ErrorCode, MediaType } from "@loomkeep/shared";
import { vi } from "vitest";
import type {
  AnilistListEntry,
  AnilistProvider,
} from "../../../catalog/providers/anilist.provider";
import { buildAnilistShows } from "./anilist.parser";
import { AnilistImportSource } from "./anilist.source";

const entry = (
  overrides: Partial<AnilistListEntry> & { id?: number } = {},
): AnilistListEntry => ({
  status: "CURRENT",
  score: 0,
  progress: 0,
  notes: null,
  startedAt: null,
  completedAt: null,
  ...overrides,
  media: {
    id: overrides.id ?? 154587,
    title: { romaji: "Sousou no Frieren", english: "Frieren" },
    seasonYear: 2023,
    coverImage: { large: "https://img/frieren.jpg" },
    isAdult: false,
    format: "TV",
  },
});

describe("buildAnilistShows", () => {
  it("carries the catalogue match, so nothing is looked up", () => {
    const [show] = buildAnilistShows([entry()]);

    expect(show.match).toEqual({
      source: CatalogSource.ANILIST,
      sourceId: "154587",
      type: MediaType.ANIME,
      title: "Frieren",
      year: 2023,
      coverUrl: "https://img/frieren.jpg",
    });
    expect(show.externalIds).toEqual({ anilist: "154587" });
  });

  it.each([
    ["CURRENT", "WATCHING"],
    ["REPEATING", "WATCHING"],
    ["PAUSED", "WATCHING"],
    ["COMPLETED", "COMPLETED"],
    ["DROPPED", "DROPPED"],
    ["PLANNING", "PLANNED"],
  ])("maps the %s list to %s", (status, expected) => {
    expect(buildAnilistShows([entry({ status })])[0].status).toBe(expected);
  });

  it("marks the episodes watched, rates on half points, keeps whole dates only", () => {
    const [show] = buildAnilistShows([
      entry({
        status: "COMPLETED",
        progress: 3,
        score: 8.7,
        notes: "  Pour Léa ",
        startedAt: { year: 2024, month: 1, day: 5 },
        completedAt: { year: 2024, month: 2, day: null },
      }),
    ]);

    expect(show.episodes.map((e) => e.episode)).toEqual([1, 2, 3]);
    expect(show.rating).toBe(8.5);
    expect(show.notes).toBe("Pour Léa");
    expect(show.startedAt).toEqual(new Date("2024-01-05T00:00:00.000Z"));
    expect(show.finishedAt).toBeNull();
  });

  it("leaves an unscored title unrated, and an anime listed twice once", () => {
    const shows = buildAnilistShows([
      entry({ score: 0 }),
      entry({ status: "COMPLETED" }),
    ]);

    expect(shows).toHaveLength(1);
    expect(shows[0].rating).toBeNull();
  });
});

describe("AnilistImportSource", () => {
  function makeSource(entries: AnilistListEntry[] = []) {
    const anilist = {
      getUserAnimeList: vi.fn().mockResolvedValue(entries),
    } as unknown as AnilistProvider;
    const source = new AnilistImportSource(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      anilist,
    );
    return { source, anilist };
  }

  it.each(["Josh", " Josh ", "https://anilist.co/user/Josh/animelist"])(
    "takes %j as the user name Josh",
    (input) => {
      expect(makeSource().source.parseInput(input).userName).toBe("Josh");
    },
  );

  it("refuses what can't be a user name before asking AniList", () => {
    expect(() => makeSource().source.parseInput("a b/c")).toThrow(
      expect.objectContaining({ code: ErrorCode.ImportAnilistUserNotFound }),
    );
  });

  it("loads the user's list as shows", async () => {
    const { source, anilist } = makeSource([entry()]);
    const parsed = source.parseInput("Josh");

    await source["load"](parsed);

    expect(anilist.getUserAnimeList).toHaveBeenCalledWith("Josh");
    expect(parsed.shows).toHaveLength(1);
  });
});
