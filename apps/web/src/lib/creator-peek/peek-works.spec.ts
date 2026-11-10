import type { CreatorWorkDto, PersonPageDto } from "@loomkeep/shared";
import { describe, expect, it } from "vitest";
import { peekWorks } from "./peek-works";

const work = (
  sourceId: string,
  extra: Partial<CreatorWorkDto> = {},
): CreatorWorkDto => ({
  domain: "MEDIA",
  type: "MOVIE",
  sourceId,
  title: sourceId,
  year: null,
  releaseDate: null,
  posterUrl: "poster.jpg",
  isAdult: false,
  jobs: [],
  character: null,
  episodeCount: null,
  genreIds: [],
  upcoming: false,
  kind: "WORK",
  editionCount: null,
  series: null,
  status: null,
  ...extra,
});

const person = (groups: PersonPageDto["groups"], knownFor = null) =>
  ({ knownFor, groups }) as unknown as PersonPageDto;

describe("peekWorks", () => {
  it("takes the best-known group's released works with a poster, newest first", () => {
    const works = peekWorks({
      ...person([
        { key: "ACTING", works: [work("cameo")] },
        {
          key: "DIRECTING",
          works: [
            work("polytechnique"),
            work("no-poster", { posterUrl: null }),
            work("next-floor", { kind: "SHORT" }),
            work("dune"),
            work("dune-3", { upcoming: true }),
          ],
        },
      ]),
      knownFor: "DIRECTING",
    });

    expect(works.map((w) => w.sourceId)).toEqual(["dune", "polytechnique"]);
  });

  it("falls back to the first group, four works at most", () => {
    const works = peekWorks(
      person([
        {
          key: "ACTING",
          works: ["a", "b", "c", "d", "e"].map((id) => work(id)),
        },
      ]),
    );

    expect(works.map((w) => w.sourceId)).toEqual(["e", "d", "c", "b"]);
  });
});
