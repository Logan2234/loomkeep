import { describe, expect, it } from "vitest";
import {
  deserializeMentions,
  highlightRuns,
  mentionAtCaret,
  serializeMentions,
} from "./composer-mentions";

const DUNE = { title: "Dune", href: "/app/books/OL893415W" };
const DUNE_2 = { title: "Dune 2", href: "/app/media/movie/693134" };

describe("composer mentions", () => {
  it("sends `#Title` as a token and reads it back", () => {
    const sent = serializeMentions("Lis #Dune avant #Dune 2 !", [DUNE, DUNE_2]);

    expect(sent).toBe(
      "Lis #[Dune](/app/books/OL893415W) avant #[Dune 2](/app/media/movie/693134) !",
    );
    expect(deserializeMentions(sent)).toEqual({
      text: "Lis #Dune avant #Dune 2 !",
      mentions: [DUNE, DUNE_2],
    });
  });

  it("finds the `#query` being typed before the caret", () => {
    expect(mentionAtCaret("Regarde #seve", 13)).toEqual({
      start: 8,
      query: "seve",
    });
    expect(mentionAtCaret("C#", 2)).toBe(null);
    expect(mentionAtCaret("#", 1)).toBe(null);
  });

  it("marks links and mentions for the underline", () => {
    expect(highlightRuns("Vu #Dune sur https://x.org !", [DUNE])).toEqual([
      { text: "Vu ", marked: false },
      { text: "#Dune", marked: true },
      { text: " sur ", marked: false },
      { text: "https://x.org", marked: true },
      { text: " !", marked: false },
    ]);
  });
});
