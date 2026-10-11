import { describe, expect, it } from "vitest";
import { completeShortcode, emojiAtCaret, findEmoji } from "./emoji";

describe("emoji shortcodes", () => {
  it("finds a name's own start before one of its words or a keyword", () => {
    expect(findEmoji("fi").map((e) => e.name)).toEqual(
      expect.arrayContaining(["fire", "fish", "film_strip"]),
    );
    expect(findEmoji("heart")[0].name).toBe("heart");
    // As good a match as :fist: or :fish:, but sent far more often.
    expect(findEmoji("fi")[0].name).toBe("fire");
    expect(findEmoji("halloween").map((e) => e.emoji)).toContain("🎃");
  });

  it("opens on a colon and two characters only", () => {
    expect(emojiAtCaret("Trop :po", 8)).toEqual({ start: 5, query: "po" });
    expect(emojiAtCaret("Trop :p", 7)).toBeNull();
    expect(emojiAtCaret("à 12:30", 7)).toBeNull();
    expect(emojiAtCaret("Trop:po", 7)).toBeNull();
  });

  it("turns a whole known code into its emoji, and leaves others", () => {
    expect(completeShortcode("Le final :fire: et", 15)).toEqual({
      value: "Le final 🔥 et",
      caret: 11,
    });
    expect(completeShortcode("Un :truc:", 9)).toBeNull();
  });
});
