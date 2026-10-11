import { m } from "#lib/paraglide/messages.js";
import type { WorkFriendsDto, WorkProgressDto } from "@loomkeep/shared";
import { describe, expect, it } from "vitest";
import {
  didLabel,
  isAhead,
  lanes,
  namesLabel,
  positionOf,
  progressLabel,
  reelMode,
  toneCounts,
} from "./work-friends";

const p = (o: Partial<WorkProgressDto>): WorkProgressDto => ({
  status: "PLANNED",
  season: null,
  episode: null,
  page: null,
  pageCount: null,
  playtimeMinutes: null,
  updatedAt: "2026-10-01T00:00:00.000Z",
  ...o,
});
const series = (me: WorkProgressDto | null): WorkFriendsDto => ({
  friends: [],
  me,
  seasons: [9, 10],
});

describe("progressLabel", () => {
  it("says where someone under way stands, in the work's terms", () => {
    expect(
      progressLabel("MEDIA", p({ status: "WATCHING", season: 2, episode: 5 })),
    ).toBe("S02E05");
    expect(
      progressLabel("BOOKS", p({ status: "READING", page: 120 })),
    ).toContain("120");
    expect(
      progressLabel("GAMES", p({ status: "PLAYING", playtimeMinutes: 960 })),
    ).toContain("16");
  });

  it("falls back on the status once done", () => {
    expect(
      progressLabel(
        "MEDIA",
        p({ status: "COMPLETED", season: 2, episode: 10 }),
      ),
    ).not.toContain("S02");
  });
});

describe("positionOf", () => {
  it("places an episode along every season", () => {
    expect(
      positionOf("MEDIA", series(null), p({ season: 2, episode: 5 })),
    ).toBeCloseTo(14 / 19);
  });

  it("places a finished book at the end", () => {
    const data = { friends: [], me: null, seasons: [] };
    expect(
      positionOf("BOOKS", data, p({ status: "READ", pageCount: 412 })),
    ).toBe(1);
    expect(
      positionOf(
        "BOOKS",
        data,
        p({ status: "READING", page: 103, pageCount: 412 }),
      ),
    ).toBe(0.25);
  });
});

describe("isAhead", () => {
  const me = p({ status: "WATCHING", season: 2, episode: 3 });

  it("counts a friend further along, or done, as ahead", () => {
    expect(
      isAhead(
        "MEDIA",
        series(me),
        p({ status: "WATCHING", season: 2, episode: 5 }),
      ),
    ).toBe(true);
    expect(isAhead("MEDIA", series(me), p({ status: "COMPLETED" }))).toBe(true);
    expect(
      isAhead(
        "MEDIA",
        series(me),
        p({ status: "WATCHING", season: 1, episode: 8 }),
      ),
    ).toBe(false);
  });

  it("counts no one once the viewer is done", () => {
    const done = series(p({ status: "COMPLETED", season: 2, episode: 10 }));
    expect(isAhead("MEDIA", done, p({ status: "COMPLETED" }))).toBe(false);
  });
});

describe("lanes", () => {
  it("sorts by status, the dropped ones with the done", () => {
    const result = lanes("GAMES", [
      p({ status: "BACKLOG" }),
      p({ status: "COMPLETED" }),
      p({ status: "DROPPED" }),
    ]);

    expect(result.map((l) => [l.tone, l.people.length])).toEqual([
      ["idle", 1],
      ["done", 2],
    ]);
    expect(result[1].title).toContain(" · ");
  });
});

describe("reelMode", () => {
  it("picks episodes, then pages, then status columns", () => {
    expect(reelMode(series(null))).toBe("episodes");
    expect(
      reelMode({
        friends: [
          { ...p({ pageCount: 300 }), user: {} as never, rating: null },
        ],
        me: null,
        seasons: [],
      }),
    ).toBe("pages");
    expect(reelMode({ friends: [], me: null, seasons: [] })).toBe("lanes");
  });
});

describe("folded line words", () => {
  it("says what someone did, in the domain's verb", () => {
    expect(didLabel("GAMES", p({ status: "COMPLETED" }))).toBe(
      m.work_friends_did_games_done(),
    );
    expect(didLabel("MUSIC", p({ status: "TO_LISTEN" }))).toBe(
      m.work_friends_did_music_idle(),
    );
  });

  it("names two, then counts the rest", () => {
    expect(namesLabel(["Léa"])).toBe("Léa");
    expect(namesLabel(["Léa", "Max"])).toBe(
      m.work_friends_names_two({ first: "Léa", second: "Max" }),
    );
    expect(namesLabel(["Léa", "Max", "Sam", "Nora"])).toBe(
      m.work_friends_names_more_many({ first: "Léa", second: "Max", count: 2 }),
    );
  });

  it("counts by status, done first", () => {
    const counts = toneCounts("GAMES", [
      p({ status: "BACKLOG" }),
      p({ status: "COMPLETED" }),
      p({ status: "COMPLETED" }),
    ]);
    expect(counts.map((c) => [c.tone, c.count])).toEqual([
      ["done", 2],
      ["idle", 1],
    ]);
  });
});
