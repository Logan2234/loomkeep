import {
  LEVEL_CAP_LEVEL,
  levelForXp,
  levelProgress,
  xpForLevel,
} from "@loomkeep/shared";

describe("xpForLevel", () => {
  it("is 0 at level 1", () => {
    expect(xpForLevel(1)).toBe(0);
  });

  it("matches the calibrated thresholds (raised once DOMAIN_STARTED alone was clearing level 2)", () => {
    expect(xpForLevel(2)).toBe(112);
    expect(xpForLevel(5)).toBe(520);
    expect(xpForLevel(10)).toBe(1440);
    expect(xpForLevel(20)).toBe(4180);
    expect(xpForLevel(40)).toBe(13_260);
    expect(xpForLevel(60)).toBe(27_140);
    expect(xpForLevel(LEVEL_CAP_LEVEL)).toBe(40_700);
    expect(xpForLevel(LEVEL_CAP_LEVEL + 1)).toBe(41_700);
    expect(xpForLevel(100)).toBe(65_700);
    expect(xpForLevel(430)).toBe(395_700);
  });

  it("is continuous across the cap boundary (74 → 75 → 76)", () => {
    const cost74to75 = xpForLevel(75) - xpForLevel(74);
    const cost75to76 = xpForLevel(76) - xpForLevel(75);
    const cost76to77 = xpForLevel(77) - xpForLevel(76);
    expect(cost74to75).toBe(988); // 100 + 12*74, still uncapped
    expect(cost75to76).toBe(1000); // 100 + 12*75 == cap, exactly
    expect(cost76to77).toBe(1000); // flat cap from here on
  });

  it("is strictly monotonic increasing", () => {
    for (let level = 1; level < 200; level++) {
      expect(xpForLevel(level + 1)).toBeGreaterThan(xpForLevel(level));
    }
  });
});

describe("levelForXp", () => {
  it("is 1 at 0 XP", () => {
    expect(levelForXp(0)).toBe(1);
  });

  it("matches the calibrated thresholds exactly at the boundary", () => {
    expect(levelForXp(112)).toBe(2);
    expect(levelForXp(111)).toBe(1);
    expect(levelForXp(1440)).toBe(10);
    expect(levelForXp(40_700)).toBe(LEVEL_CAP_LEVEL);
    expect(levelForXp(41_700)).toBe(LEVEL_CAP_LEVEL + 1);
    expect(levelForXp(42_700)).toBe(LEVEL_CAP_LEVEL + 2);
    expect(levelForXp(395_700)).toBe(430);
  });

  it("handles a very large XP total past the cap", () => {
    expect(levelForXp(10_000_000)).toBeGreaterThan(LEVEL_CAP_LEVEL);
  });

  it("round-trips with xpForLevel over a large sample of levels", () => {
    for (let level = 1; level <= 500; level++) {
      const xp = xpForLevel(level);
      expect(levelForXp(xp)).toBe(level);

      // One XP short of the threshold must still read as the previous level.
      if (xp > 0) {
        expect(levelForXp(xp - 1)).toBe(level - 1);
      }
    }
  });
});

describe("levelProgress", () => {
  it("reports 0 XP into level 1 and the cost of the next level at 0 XP", () => {
    expect(levelProgress(0)).toEqual({
      level: 1,
      xpInLevel: 0,
      xpToNext: 112,
    });
  });

  it("reports partial progress mid-level", () => {
    // 30 XP into level 1 (which costs 112 to clear).
    expect(levelProgress(30)).toEqual({
      level: 1,
      xpInLevel: 30,
      xpToNext: 82,
    });
  });

  it("is consistent across the cap boundary", () => {
    const progress = levelProgress(40_700 + 500);
    expect(progress.level).toBe(LEVEL_CAP_LEVEL);
    expect(progress.xpInLevel).toBe(500);
    expect(progress.xpToNext).toBe(500);
  });
});
