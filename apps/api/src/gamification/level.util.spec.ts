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

  it("matches the calibrated thresholds from the [G1] plan", () => {
    expect(xpForLevel(2)).toBe(52);
    expect(xpForLevel(5)).toBe(280);
    expect(xpForLevel(10)).toBe(900);
    expect(xpForLevel(20)).toBe(3040);
    expect(xpForLevel(40)).toBe(10_920);
    expect(xpForLevel(60)).toBe(23_600);
    expect(xpForLevel(LEVEL_CAP_LEVEL)).toBe(41_080);
    expect(xpForLevel(LEVEL_CAP_LEVEL + 1)).toBe(42_080);
    expect(xpForLevel(100)).toBe(61_080);
    expect(xpForLevel(430)).toBe(391_080);
  });

  it("is continuous across the cap boundary (79 → 80 → 81)", () => {
    const cost79to80 = xpForLevel(80) - xpForLevel(79);
    const cost80to81 = xpForLevel(81) - xpForLevel(80);
    const cost81to82 = xpForLevel(82) - xpForLevel(81);
    expect(cost79to80).toBe(988); // 40 + 12*79, still uncapped
    expect(cost80to81).toBe(1000); // 40 + 12*80 == cap, exactly
    expect(cost81to82).toBe(1000); // flat cap from here on
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
    expect(levelForXp(52)).toBe(2);
    expect(levelForXp(51)).toBe(1);
    expect(levelForXp(900)).toBe(10);
    expect(levelForXp(41_080)).toBe(LEVEL_CAP_LEVEL);
    expect(levelForXp(42_080)).toBe(LEVEL_CAP_LEVEL + 1);
    expect(levelForXp(43_080)).toBe(LEVEL_CAP_LEVEL + 2);
    expect(levelForXp(391_080)).toBe(430);
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
      xpToNext: 52,
    });
  });

  it("reports partial progress mid-level", () => {
    // 30 XP into level 1 (which costs 52 to clear).
    expect(levelProgress(30)).toEqual({
      level: 1,
      xpInLevel: 30,
      xpToNext: 22,
    });
  });

  it("is consistent across the cap boundary", () => {
    const progress = levelProgress(41_080 + 500);
    expect(progress.level).toBe(LEVEL_CAP_LEVEL);
    expect(progress.xpInLevel).toBe(500);
    expect(progress.xpToNext).toBe(500);
  });
});
