import type { AchievementDto } from "@loomkeep/shared";
import { describe, expect, it } from "vitest";
import { groupAchievements, sectionsByFamily, summarize } from "./achievements";

function entry(over: Partial<AchievementDto> = {}): AchievementDto {
  return {
    key: "some_key",
    family: "volume",
    tierOf: null,
    tier: null,
    xpAward: 50,
    secret: false,
    unlocked: false,
    unlockedAt: null,
    progress: null,
    ...over,
  };
}

const CINEPHILE: AchievementDto[] = [
  entry({
    key: "cinephile_bronze",
    tierOf: "cinephile",
    tier: "bronze",
    xpAward: 50,
    unlocked: true,
    unlockedAt: "2026-03-02T00:00:00.000Z",
    progress: { current: 68, target: 10 },
  }),
  entry({
    key: "cinephile_silver",
    tierOf: "cinephile",
    tier: "silver",
    xpAward: 150,
    unlocked: true,
    unlockedAt: "2026-08-14T00:00:00.000Z",
    progress: { current: 68, target: 50 },
  }),
  entry({
    key: "cinephile_gold",
    tierOf: "cinephile",
    tier: "gold",
    xpAward: 400,
    progress: { current: 68, target: 200 },
  }),
];

describe("groupAchievements", () => {
  it("folds a tiered family into a single card", () => {
    const groups = groupAchievements(CINEPHILE);

    expect(groups).toHaveLength(1);
    expect(groups[0].id).toBe("cinephile");
    expect(groups[0].entries.map((e) => e.tier)).toEqual([
      "bronze",
      "silver",
      "gold",
    ]);
  });

  it("rings the medallion with the tier reached, not the family's maximum", () => {
    const [group] = groupAchievements(CINEPHILE);

    expect(group.reachedTier).toBe("silver");
    expect(group.unlockedCount).toBe(2);
    expect(group.next?.key).toBe("cinephile_gold");
    expect(group.xpEarned).toBe(200);
  });

  it("treats an unlocked untiered achievement as gold, with no next tier", () => {
    const [group] = groupAchievements([
      entry({ key: "night_owl", family: "ritual", unlocked: true }),
    ]);

    expect(group.reachedTier).toBe("gold");
    expect(group.next).toBeNull();
  });

  it("gives every masked secret its own card", () => {
    const masked = entry({
      key: null,
      tierOf: null,
      tier: null,
      xpAward: null,
      secret: true,
      family: "misc",
    });

    const groups = groupAchievements([masked, { ...masked }]);

    expect(groups).toHaveLength(2);
    expect(groups.every((g) => g.masked)).toBe(true);
  });
});

describe("sectionsByFamily", () => {
  it("orders families and counts entries, not cards", () => {
    const sections = sectionsByFamily(
      groupAchievements([
        ...CINEPHILE,
        entry({ key: "night_owl", family: "ritual", unlocked: true }),
      ]),
    );

    expect(sections.map((s) => s.family)).toEqual(["volume", "ritual"]);
    expect(sections[0]).toMatchObject({ unlockedEntries: 2, totalEntries: 3 });
  });
});

describe("summarize", () => {
  it("counts entries, XP and secrets, newest unlocks first", () => {
    const summary = summarize([
      ...CINEPHILE,
      entry({
        key: "hidden_gem",
        family: "exploration",
        secret: true,
        xpAward: 400,
        unlocked: true,
        unlockedAt: "2026-09-01T00:00:00.000Z",
      }),
      entry({ key: null, xpAward: null, secret: true, family: "misc" }),
    ]);

    expect(summary).toMatchObject({
      unlocked: 3,
      total: 5,
      xpEarned: 600,
      secretsFound: 1,
      secretsTotal: 2,
    });
    expect(summary.recent.map((e) => e.key)).toEqual([
      "hidden_gem",
      "cinephile_silver",
      "cinephile_bronze",
    ]);
  });
});
