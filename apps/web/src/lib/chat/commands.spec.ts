import { describe, expect, it } from "vitest";
import { pickChoices, pollReady, sagaChoices } from "./commands";

describe("/pick", () => {
  it("offers the domains with a pile, in the viewer's order, the ones off left out", () => {
    const choices = pickChoices(
      ["BOOKS", "PODCASTS", "MEDIA", "MUSIC", "GAMES"],
      (domain) => domain !== "MUSIC",
      "",
    );

    expect(choices.map((c) => c.name)).toEqual(["books", "video", "games"]);
  });

  it("narrows to what's typed after /pick", () => {
    expect(
      pickChoices(["MEDIA", "GAMES"], () => true, "ga").map((c) => c.name),
    ).toEqual(["games"]);
  });
});

describe("/saga", () => {
  const saga = (key: string, title: string, member: string) => ({
    key,
    title,
    members: [{ title: member, posterUrl: `${key}.jpg` }],
    next: null,
    seen: 1,
    released: 3,
    lastActivityAt: "2026-10-01T00:00:00.000Z",
    finishedAt: null,
  });

  it("puts the sagas in progress first, whatever their domain", () => {
    const choices = sagaChoices(
      [
        {
          domain: "MEDIA",
          list: {
            inProgress: [],
            waiting: [],
            finished: [
              saga("TMDB:1", "Retour vers le futur", "Retour vers le futur"),
            ],
          },
        },
        {
          domain: "GAMES",
          list: {
            inProgress: [saga("IGDB:2", "The Witcher", "The Witcher 3")],
            waiting: [],
            finished: [],
          },
        },
      ],
      "",
    );

    expect(choices.map((c) => [c.domain, c.key, c.imageUrl])).toEqual([
      ["GAMES", "IGDB:2", "IGDB:2.jpg"],
      ["MEDIA", "TMDB:1", "TMDB:1.jpg"],
    ]);
  });

  it("finds a saga by one of its works", () => {
    const choices = sagaChoices(
      [
        {
          domain: "GAMES",
          list: {
            inProgress: [saga("IGDB:2", "The Witcher", "The Witcher 3")],
            waiting: [],
            finished: [],
          },
        },
      ],
      "witcher 3",
    );

    expect(choices).toHaveLength(1);
  });
});

describe("/poll", () => {
  const option = (text: string) => ({ text, work: null });

  it("needs a question and two options", () => {
    expect(pollReady("Ce soir ?", [option("Dune"), option(" ")])).toBe(false);
    expect(pollReady(" ", [option("Dune"), option("Alien")])).toBe(false);
    expect(pollReady("Ce soir ?", [option("Dune"), option("Alien")])).toBe(
      true,
    );
  });
});
