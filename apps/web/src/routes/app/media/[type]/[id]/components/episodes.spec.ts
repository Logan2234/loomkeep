import type { MediaDetailSeasonDto } from "@loomkeep/shared";
import { describe, expect, it } from "vitest";
import {
  arrivalTabKey,
  episodeTabs,
  largeTmdbImage,
  nextUpEpisode,
  playlist,
  runProgress,
  selectionActions,
  selectionRange,
  selectionSpan,
  tabKeyOf,
  unwatchedGapCount,
} from "./episodes";

const NOW = new Date("2026-10-14T12:00:00Z");

function season(
  number: number,
  episodes: { watched?: boolean; airDate?: string | null }[],
): MediaDetailSeasonDto {
  return {
    number,
    episodes: episodes.map((e, i) => ({
      id: `s${number}e${i + 1}`,
      number: i + 1,
      watchCount: e.watched ? 1 : 0,
      airDate: e.airDate === undefined ? "2026-01-01T00:00:00Z" : e.airDate,
    })),
  } as MediaDetailSeasonDto;
}

const many = (count: number) =>
  Array.from({ length: count }, () => ({}) as { watched?: boolean });

describe("episodeTabs", () => {
  it("gives each season one tab, specials last", () => {
    const tabs = episodeTabs([
      season(0, [{}]),
      season(1, [{}]),
      season(2, [{}]),
    ]);
    expect(tabs.map((t) => t.key)).toEqual(["s1", "s2", "s0"]);
    expect(tabs.every((t) => t.range === null)).toBe(true);
  });

  it("cuts a single season over 100 episodes into tabs of 100", () => {
    const tabs = episodeTabs([season(1, many(1180)), season(0, [{}])]);
    expect(tabs.map((t) => t.range)).toEqual([
      ...Array.from({ length: 11 }, (_, i) => ({
        from: i * 100 + 1,
        to: (i + 1) * 100,
      })),
      { from: 1101, to: 1180 },
      null,
    ]);
    expect(tabs[0].episodes).toHaveLength(100);
  });

  it("keeps a season of exactly 100 whole", () => {
    expect(episodeTabs([season(1, many(100))])).toHaveLength(1);
  });

  it("never cuts when there are several seasons, however long", () => {
    const tabs = episodeTabs([season(1, many(120)), season(2, many(140))]);
    expect(tabs.map((t) => t.key)).toEqual(["s1", "s2"]);
  });

  it("leaves out a season with no episodes", () => {
    expect(episodeTabs([season(1, [{}]), season(2, [])])).toHaveLength(1);
  });

  it("finds an episode's tab", () => {
    const tabs = episodeTabs([season(1, many(250))]);
    expect(tabKeyOf(tabs, 1, 212)).toBe(tabs[2].key);
    expect(tabKeyOf(tabs, 1, 999)).toBeNull();
  });
});

describe("arrivalTabKey", () => {
  const arrival = (seasons: MediaDetailSeasonDto[], tracked = true) =>
    arrivalTabKey(episodeTabs(seasons), seasons, tracked, NOW);

  it("opens where the next episode is", () => {
    expect(arrival([season(1, [{ watched: true }]), season(2, [{}, {}])])).toBe(
      "s2",
    );
  });

  it("opens the slice holding the next episode", () => {
    const seasons = [
      season(
        1,
        many(250).map((e, i) => (i < 150 ? { watched: true } : e)),
      ),
    ];
    expect(arrival(seasons)).toBe(episodeTabs(seasons)[1].key);
  });

  it("opens the last regular season once up to date, not the specials", () => {
    expect(
      arrival([
        season(1, [{ watched: true }]),
        season(2, [{ watched: true }]),
        season(0, [{}]),
      ]),
    ).toBe("s2");
  });

  it("opens the first season of a show not followed", () => {
    expect(
      arrival(
        [season(1, [{ airDate: "2027-01-01T00:00:00Z" }]), season(2, [{}])],
        false,
      ),
    ).toBe("s2");
    expect(
      arrival(
        [
          season(1, [{ airDate: "2027-01-01T00:00:00Z" }]),
          season(2, [{ airDate: "2027-01-01T00:00:00Z" }]),
        ],
        false,
      ),
    ).toBe("s1");
  });

  it("leaves specials out of what's next", () => {
    expect(
      nextUpEpisode([season(1, [{ watched: true }]), season(0, [{}])], NOW),
    ).toBeNull();
  });
});

describe("selection", () => {
  const list = season(1, [
    { watched: true },
    {},
    { airDate: "2027-01-01T00:00:00Z" },
    {},
  ]).episodes;
  const ids = list.map((e) => e.id!);

  it("takes the range between two rows either way, skipping what hasn't aired", () => {
    const expected = [ids[1], ids[3]];
    expect(selectionRange(list, ids[1], ids[3], NOW)).toEqual(expected);
    expect(selectionRange(list, ids[3], ids[1], NOW)).toEqual(expected);
  });

  it("counts what each action would really touch", () => {
    expect(selectionActions(list.slice(0, 2), NOW)).toEqual({
      watch: [ids[1]],
      rewatch: [ids[0]],
      unwatch: [ids[0]],
    });
  });

  it("gives a selection's ends in one tab, or how many tabs", () => {
    const tabs = episodeTabs([season(1, [{}, {}, {}]), season(2, [{}])]);
    const one = new Set([tabs[0].episodes[0].id!, tabs[0].episodes[2].id!]);
    expect(selectionSpan(tabs, one, NOW)).toEqual({
      tabs: 1,
      seasonNumber: 1,
      first: 1,
      last: 3,
      contiguous: false,
    });
    expect(
      selectionSpan(tabs, new Set([...one, tabs[0].episodes[1].id!]), NOW),
    ).toMatchObject({ contiguous: true });
    expect(
      selectionSpan(tabs, new Set([...one, tabs[1].episodes[0].id!]), NOW),
    ).toEqual({ tabs: 2, sliced: false });
    expect(selectionSpan(tabs, new Set(), NOW)).toBeNull();
  });
});

describe("runProgress", () => {
  it("counts watched and aired episodes of the regular run", () => {
    const seasons = [
      season(0, [{ watched: true }]),
      season(1, [{ watched: true }, {}, { airDate: "2027-01-01T00:00:00Z" }]),
    ];
    expect(runProgress(seasons, NOW)).toEqual({ watched: 1, aired: 2 });
  });
});

describe("unwatchedGapCount", () => {
  it("counts the earlier unwatched regular episodes only", () => {
    const seasons = [
      season(0, [{}]),
      season(1, [{ watched: true }, {}]),
      season(2, [{}, {}]),
    ];
    expect(unwatchedGapCount(seasons, 2, 2)).toBe(2);
    expect(unwatchedGapCount(seasons, 0, 1)).toBe(0);
  });
});

describe("largeTmdbImage", () => {
  it("asks TMDB for a larger size, and leaves other hosts alone", () => {
    expect(largeTmdbImage("https://image.tmdb.org/t/p/w300/a.jpg")).toBe(
      "https://image.tmdb.org/t/p/w780/a.jpg",
    );
    expect(largeTmdbImage("https://img1.ak.crunchyroll.com/i/a_full.jpg")).toBe(
      "https://img1.ak.crunchyroll.com/i/a_full.jpg",
    );
  });
});

describe("playlist", () => {
  it("runs through the regular seasons in order, specials apart", () => {
    const seasons = [season(2, [{}]), season(0, [{}]), season(1, [{}, {}])];
    expect(playlist(seasons, 1)).toEqual([
      { season: 1, episode: 1 },
      { season: 1, episode: 2 },
      { season: 2, episode: 1 },
    ]);
    expect(playlist(seasons, 0)).toEqual([{ season: 0, episode: 1 }]);
  });
});
