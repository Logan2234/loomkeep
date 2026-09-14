import { describe, expect, it } from "vitest";
import {
  LEVEL_BASE,
  LEVEL_CAP_COST,
  LEVEL_CAP_LEVEL,
  LEVEL_STEP,
  levelForXp,
  levelProgress,
  xpForLevel,
} from "./level";

/** The curve's definition, evaluated the slow way, as an oracle for the closed forms. */
function xpForLevelBySummation(level: number): number {
  let total = 0;

  for (let n = 1; n < level; n++) {
    total += Math.min(LEVEL_BASE + LEVEL_STEP * n, LEVEL_CAP_COST);
  }

  return total;
}

describe("xpForLevel", () => {
  it("starts a new account at level 1 with nothing to show for it", () => {
    expect(xpForLevel(1)).toBe(0);
  });

  it("matches the summed per-level costs on both sides of the cap", () => {
    for (let level = 1; level <= 120; level++) {
      expect(xpForLevel(level)).toBe(xpForLevelBySummation(level));
    }
  });

  it("joins its two branches without a seam at the cap", () => {
    // The uncapped quadratic and the flat branch have to agree exactly at
    // LEVEL_CAP_LEVEL + 1 — an invariant of the two formulas, not of any
    // particular constant, so it needs holding onto if either changes.
    const boundary = LEVEL_CAP_LEVEL + 1;
    expect(xpForLevel(boundary + 1) - xpForLevel(boundary)).toBe(
      LEVEL_CAP_COST,
    );
    expect(xpForLevel(boundary) - xpForLevel(boundary - 1)).toBe(
      LEVEL_CAP_COST,
    );
  });

  it("keeps the first milestone from being a level-up on its own", () => {
    // DOMAIN_STARTED grants 100 XP the first time a user tracks anything;
    // level 2 has to cost more than that, or a brand-new account levels up
    // for adding one item (see level.ts's note on raising LEVEL_BASE).
    expect(xpForLevel(2)).toBeGreaterThan(100);
  });
});

describe("levelForXp", () => {
  it("is the exact inverse of xpForLevel, at the threshold and just under it", () => {
    for (let level = 1; level <= 120; level++) {
      const threshold = xpForLevel(level);
      expect(levelForXp(threshold)).toBe(level);
      if (level > 1) expect(levelForXp(threshold - 1)).toBe(level - 1);
    }
  });

  it("never goes backwards as XP accumulates", () => {
    let previous = levelForXp(0);

    for (let xp = 0; xp <= 60_000; xp += 37) {
      const level = levelForXp(xp);
      expect(level).toBeGreaterThanOrEqual(previous);
      previous = level;
    }
  });

  it("holds level 1 until the first threshold is crossed", () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(xpForLevel(2) - 1)).toBe(1);
  });
});

describe("levelProgress", () => {
  it("splits the total into the level reached and the distance to the next", () => {
    const xp = xpForLevel(12) + 40;
    const progress = levelProgress(xp);

    expect(progress.level).toBe(12);
    expect(progress.xpInLevel).toBe(40);
    expect(progress.xpInLevel + progress.xpToNext).toBe(
      xpForLevel(13) - xpForLevel(12),
    );
  });

  it("reports a fresh level as having spent nothing inside it", () => {
    expect(levelProgress(xpForLevel(30)).xpInLevel).toBe(0);
  });

  it("keeps the progress bar bounded at every XP total", () => {
    for (let xp = 0; xp <= 60_000; xp += 211) {
      const { xpInLevel, xpToNext } = levelProgress(xp);
      expect(xpInLevel).toBeGreaterThanOrEqual(0);
      expect(xpToNext).toBeGreaterThan(0);
    }
  });
});
