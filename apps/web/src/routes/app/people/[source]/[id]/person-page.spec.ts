import type { CreatorWorkDto } from "@loomkeep/shared";
import { describe, expect, it } from "vitest";
import {
  lifeYears,
  mixesTypes,
  splitCredits,
  visibleWorks,
} from "./person-page";

const work = (
  sourceId: string,
  extra: Partial<CreatorWorkDto> = {},
): CreatorWorkDto => ({
  type: "MOVIE",
  sourceId,
  title: sourceId,
  year: null,
  releaseDate: null,
  posterUrl: null,
  isAdult: false,
  jobs: [],
  character: null,
  episodeCount: null,
  genreIds: [],
  upcoming: false,
  kind: "WORK",
  status: null,
  ...extra,
});

// As the API sends them: oldest first, the undated announcement last.
const works = [
  work("dune", { releaseDate: "2021-09-15", status: "COMPLETED" }),
  work("prophecy", { type: "SERIES", releaseDate: "2024-11-17" }),
  work("messiah", { upcoming: true }),
];

describe("visibleWorks", () => {
  it("puts the newest first, announcements leading", () => {
    const ids = visibleWorks(works, {
      type: "ALL",
      inLibrary: false,
      order: "newest",
    }).map((w) => w.sourceId);

    expect(ids).toEqual(["messiah", "prophecy", "dune"]);
  });

  it("keeps the API's order oldest first, without reordering its input", () => {
    const input = [...works];

    visibleWorks(input, { type: "ALL", inLibrary: false, order: "newest" });
    const ids = visibleWorks(input, {
      type: "ALL",
      inLibrary: false,
      order: "oldest",
    }).map((w) => w.sourceId);

    expect(ids).toEqual(["dune", "prophecy", "messiah"]);
  });

  it("filters by type and by presence in the library", () => {
    const series = visibleWorks(works, {
      type: "SERIES",
      inLibrary: false,
      order: "oldest",
    });
    const tracked = visibleWorks(works, {
      type: "ALL",
      inLibrary: true,
      order: "oldest",
    });

    expect(series.map((w) => w.sourceId)).toEqual(["prophecy"]);
    expect(tracked.map((w) => w.sourceId)).toEqual(["dune"]);
  });
});

describe("mixesTypes", () => {
  it("is true only when films and series both appear", () => {
    expect(mixesTypes(works)).toBe(true);
    expect(mixesTypes([works[0]])).toBe(false);
  });
});

describe("splitCredits", () => {
  it("keeps works and shorts in the tabs, and lists each appearance once, newest first", () => {
    const { tabs, mentions } = splitCredits([
      {
        key: "DIRECTING",
        works: [work("next-floor", { kind: "SHORT" }), work("dune")],
      },
      {
        key: "ACTING",
        works: [
          work("lucid-dreams", {
            kind: "DOCUMENTARY",
            releaseDate: "2014-06-24",
          }),
          work("late-show", {
            type: "SERIES",
            kind: "TV_APPEARANCE",
            releaseDate: "2015-09-08",
          }),
          work("screening", { kind: "DOCUMENTARY" }),
        ],
      },
      {
        key: "CREW",
        works: [
          work("lucid-dreams", { kind: "THANKS", releaseDate: "2014-06-24" }),
        ],
      },
    ]);

    expect(tabs).toEqual([
      {
        key: "DIRECTING",
        works: [
          expect.objectContaining({ sourceId: "next-floor" }),
          expect.objectContaining({ sourceId: "dune" }),
        ],
      },
    ]);
    expect(mentions.map((w) => [w.sourceId, w.kind])).toEqual([
      ["screening", "DOCUMENTARY"],
      ["late-show", "TV_APPEARANCE"],
      ["lucid-dreams", "DOCUMENTARY"],
    ]);
  });
});

describe("lifeYears", () => {
  it("gives the birth year, and the death year when there is one", () => {
    expect(lifeYears("1967-10-03", null)).toBe("1967");
    expect(lifeYears("1929-10-21", "2018-01-22")).toBe("1929 – 2018");
    expect(lifeYears(null, "2018-01-22")).toBe("† 2018");
    expect(lifeYears(null, null)).toBeNull();
  });
});
