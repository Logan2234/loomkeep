/**
 * Level curve for the XP ledger (G1). Shared between the API (level-up
 * detection, leaderboards) and the web (progress bar) so both read the exact
 * same thresholds.
 *
 * cost(N → N+1) = min(LEVEL_BASE + LEVEL_STEP × N, LEVEL_CAP_COST), where N
 * is the level being left. The constant term gives the first levels real
 * weight (level 2 costs 52 XP — a real evening, not a couple of clicks); the
 * cap makes every level cost the same 1000 XP past LEVEL_CAP_LEVEL, so a
 * heavy user's level keeps climbing forever without the curve blowing up.
 *
 * Closed form (avoids an O(level) loop to answer "what level is N XP" — see
 * `levelForXp`): summing the per-level cost above from level 1 up to L gives
 * an arithmetic series while uncapped, then a flat term once capped.
 *   xpForLevel(L), L ≤ LEVEL_CAP_LEVEL + 1: (L − 1) × (LEVEL_BASE + 6L)
 *     — derived from Σ_{N=1}^{L-1} (40 + 12N) = (L-1)·40 + 12·(L-1)L/2
 *                                              = (L-1)·(40 + 6L)
 *   xpForLevel(L), L > LEVEL_CAP_LEVEL + 1: XP_AT_CAP_LEVEL + (L − LEVEL_CAP_LEVEL − 1) × LEVEL_CAP_COST
 * Both branches agree exactly at L = LEVEL_CAP_LEVEL + 1 (81): the last
 * uncapped step (level 80 → 81) already costs exactly LEVEL_CAP_COST, so the
 * quadratic and the linear formula meet without a seam — verified by
 * `level.util.spec.ts`'s continuity test around that boundary.
 */
export const LEVEL_BASE = 40;
export const LEVEL_STEP = 12;
export const LEVEL_CAP_COST = 1000;
// Level whose outgoing step first hits LEVEL_CAP_COST: 40 + 12×80 = 1000.
export const LEVEL_CAP_LEVEL = 80;
// xpForLevel(LEVEL_CAP_LEVEL + 1), i.e. the cumulative XP at which every
// subsequent level starts costing a flat LEVEL_CAP_COST. Precomputed so
// `levelForXp` doesn't need to evaluate the quadratic branch to find it.
const XP_AT_CAP_LEVEL = 42_080;

/** Cumulative XP required to reach `level` (level 1 = 0 XP). */
export function xpForLevel(level: number): number {
  if (level <= LEVEL_CAP_LEVEL + 1) {
    return (level - 1) * (LEVEL_BASE + 6 * level);
  }

  return XP_AT_CAP_LEVEL + (level - (LEVEL_CAP_LEVEL + 1)) * LEVEL_CAP_COST;
}

/** The level reached at a given XP total (exact, O(1) — inverse of `xpForLevel`). */
export function levelForXp(xp: number): number {
  if (xp <= XP_AT_CAP_LEVEL) {
    return Math.floor((Math.sqrt(2116 + 24 * xp) - 34) / 12);
  }

  return (
    LEVEL_CAP_LEVEL + 1 + Math.floor((xp - XP_AT_CAP_LEVEL) / LEVEL_CAP_COST)
  );
}

/** Current level plus progress within it, for a level-up bar. */
export function levelProgress(xp: number): {
  level: number;
  xpInLevel: number;
  xpToNext: number;
} {
  const level = levelForXp(xp);
  return {
    level,
    xpInLevel: xp - xpForLevel(level),
    xpToNext: xpForLevel(level + 1) - xp,
  };
}
