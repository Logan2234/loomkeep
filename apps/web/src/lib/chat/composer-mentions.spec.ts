import { describe, expect, it } from "vitest";
import {
  composerRuns,
  deserializeMentions,
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

  it("underlines links and mentions", () => {
    expect(
      composerRuns("Vu #Dune sur https://x.org !", [DUNE]).map((run) => [
        run.text,
        run.underlined,
      ]),
    ).toEqual([
      ["Vu ", false],
      ["#Dune", true],
      [" sur ", false],
      ["https://x.org", true],
      [" !", false],
    ]);
  });

  it("styles the text as it'll read once sent, its markers dimmed", () => {
    const runs = composerRuns("Le **final** de ||Dark|| et `S1`", []);

    expect(runs.map((run) => [run.text, run.styles.join("+")])).toEqual([
      ["Le ", ""],
      ["**", "marker"],
      ["final", "strong"],
      ["**", "marker"],
      [" de ", ""],
      ["||", "marker"],
      ["Dark", "spoiler"],
      ["||", "marker"],
      [" et ", ""],
      ["`", "marker"],
      ["S1", "code"],
      ["`", "marker"],
    ]);
  });

  it("dims a quote's or a list's prefix and nests bold in italic", () => {
    const runs = composerRuns("> *un **gros** mot*\n- point", []);

    expect(runs.map((run) => [run.text, run.styles.join("+")])).toEqual([
      ["> *", "marker"],
      ["un ", "em"],
      ["**", "em+marker"],
      ["gros", "em+strong"],
      ["**", "em+marker"],
      [" mot", "em"],
      ["*", "marker"],
      ["\n", ""],
      ["- ", "marker"],
      ["point", ""],
    ]);
  });

  // Counted in UTF-16 units, as the field counts: an emoji takes two.
  it("keeps its styles in place after an emoji", () => {
    const runs = composerRuns("🔥 **ok**", []);

    expect(runs.map((run) => [run.text, run.styles.join("+")])).toEqual([
      ["🔥 ", ""],
      ["**", "marker"],
      ["ok", "strong"],
      ["**", "marker"],
    ]);
  });

  it("leaves an unclosed marker as it is", () => {
    expect(composerRuns("2 * 3 **", [])).toEqual([
      { text: "2 * 3 **", styles: [], underlined: false },
    ]);
  });
});
