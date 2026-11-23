import { describe, expect, it } from "vitest";
import { gameLanguageLevel, viewerLanguageFirst } from "./game-languages";

const lang = (locale: string, kinds: string) => ({
  locale,
  interface: kinds.includes("i"),
  subtitles: kinds.includes("s"),
  audio: kinds.includes("a"),
});

describe("gameLanguageLevel", () => {
  it("says voiced when any variant of the language has audio", () => {
    expect(
      gameLanguageLevel([lang("fr-FR", "is"), lang("fr-CA", "a")], "fr"),
    ).toBe("full");
  });

  it("says text only without audio", () => {
    expect(gameLanguageLevel([lang("it-IT", "s")], "it")).toBe("text");
  });

  it("says not available when other languages are listed", () => {
    expect(gameLanguageLevel([lang("en-US", "isa")], "fr")).toBe("none");
  });

  it("says nothing when IGDB lists no language", () => {
    expect(gameLanguageLevel([], "fr")).toBeNull();
  });
});

describe("viewerLanguageFirst", () => {
  it("moves the viewer's language ahead, keeping the rest in order", () => {
    expect(
      viewerLanguageFirst(
        [lang("en-US", "i"), lang("ja-JP", "i"), lang("fr-FR", "i")],
        "fr",
      ).map((l) => l.locale),
    ).toEqual(["fr-FR", "en-US", "ja-JP"]);
  });
});
