import type { PremiereDto } from "@loomkeep/shared";
import { describe, expect, it } from "vitest";
import { groupPremieres, pickHeadliner } from "./premiere-groups";

const premiere = (
  firstAirDate: string,
  title = firstAirDate,
  extra: Partial<PremiereDto> = {},
): PremiereDto => ({
  sourceId: title,
  title,
  originalTitle: null,
  firstAirDate,
  networkId: 213,
  networkName: "Netflix",
  originCountries: ["US"],
  overview: null,
  posterUrl: "https://image.tmdb.org/t/p/w500/p.jpg",
  backdropUrl: null,
  popularity: 1,
  ...extra,
});

// A Sunday afternoon, local time.
const now = new Date(2026, 10, 15, 15, 0);

describe("groupPremieres", () => {
  it("splits today, four weekly rails and the months after", () => {
    const { today, rails } = groupPremieres(
      [
        premiere("2026-11-14", "yesterday"),
        premiere("2026-11-15", "today"),
        premiere("2026-11-16", "tomorrow"),
        premiere("2026-11-22", "end of this week"),
        premiere("2026-11-23", "next week"),
        premiere("2026-12-13", "fourth week"),
        premiere("2026-12-14", "december"),
        premiere("2027-01-06", "january"),
      ],
      now,
    );

    expect(today.map((p) => p.title)).toEqual(["today"]);
    expect(rails.map((r) => [r.kind, r.items.map((p) => p.title)])).toEqual([
      ["thisWeek", ["tomorrow", "end of this week"]],
      ["nextWeek", ["next week"]],
      ["week", ["fourth week"]],
      ["month", ["december"]],
      ["month", ["january"]],
    ]);
  });

  it("dates each weekly rail from the day after today, and leaves an empty week out", () => {
    const { rails } = groupPremieres(
      [premiere("2026-11-17"), premiere("2026-12-01")],
      now,
    );

    expect(rails.map((r) => [r.from.getDate(), r.to?.getDate()])).toEqual([
      [16, 22],
      [30, 6],
    ]);
  });
});

describe("pickHeadliner", () => {
  const banner = { backdropUrl: "https://image.tmdb.org/b.jpg", overview: "…" };

  it("takes the week's most popular premiere that can fill the banner", () => {
    const pick = pickHeadliner(
      [
        premiere("2026-11-16", "no image", { popularity: 50 }),
        premiere("2026-11-17", "awaited", { ...banner, popularity: 9 }),
        premiere("2026-11-19", "quiet", { ...banner, popularity: 2 }),
        premiere("2026-11-23", "next week", { ...banner, popularity: 90 }),
      ],
      now,
    );

    expect(pick?.title).toBe("awaited");
  });

  it("is null when nothing this week has a banner image", () => {
    expect(pickHeadliner([premiere("2026-11-16")], now)).toBeNull();
  });
});
