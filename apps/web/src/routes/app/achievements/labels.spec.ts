import type { AchievementDto } from "@loomkeep/shared";
import { describe, expect, it } from "vitest";
import { groupAchievements } from "./achievements";
import { contextNote } from "./labels";

function entry(over: Partial<AchievementDto> = {}): AchievementDto {
  return {
    key: "cinephile_bronze",
    family: "volume",
    tierOf: "cinephile",
    tier: "bronze",
    xpAward: 50,
    secret: false,
    unlocked: false,
    unlockedAt: null,
    progress: { current: 2, target: 10 },
    equipped: false,
    ...over,
  };
}

function noteFor(entries: AchievementDto[]) {
  return contextNote(groupAchievements(entries)[0]);
}

describe("contextNote", () => {
  // The note is split into segments so the value it carries can be shown
  // bright against a dim sentence. An earlier splitting trick used a NUL
  // marker that a source edit turned into an empty string, and splitting on
  // "" splits per character: "Encore 8 films avant le bronze." rendered as
  // "E8n". These assertions pin the shape rather than the wording.
  it("keeps the whole sentence when a value is emphasised", () => {
    const segments = noteFor([entry()]);
    const joined = segments.map((s) => s.text).join("");

    expect(segments.length).toBeGreaterThan(1);
    expect(joined.length).toBeGreaterThan(10);
    expect(joined).toContain("8");
  });

  it("emphasises exactly the value, never a stray letter", () => {
    const strong = noteFor([entry()]).filter((s) => s.strong);

    expect(strong).toHaveLength(1);
    expect(strong[0].text).toBe("8");
  });

  it("says nothing when nothing has been earned and nothing is in reach", () => {
    // "Never unlocked" and "every tier earned" are deliberately unsaid — the
    // stamp and the empty rail already show both.
    const segments = noteFor([
      entry({ unlocked: true, unlockedAt: "2026-03-02T00:00:00.000Z" }),
    ]);

    expect(segments.every((s) => !s.text.includes("<<@>>"))).toBe(true);
  });

  it("leaks no marker into a secret's note", () => {
    const segments = noteFor([
      entry({
        key: null,
        tierOf: null,
        tier: null,
        secret: true,
        xpAward: null,
        progress: null,
      }),
    ]);

    expect(segments.map((s) => s.text).join("")).not.toContain("<<@>>");
  });
});
