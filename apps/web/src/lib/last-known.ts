/**
 * "Last known value" tracking, shared by the two rise-only reactions of [G6]:
 * the level-up bubble and the streak badge. Factored out rather than written
 * twice because both need the exact same rule, including the one that
 * matters most — a drop updates the stored value *in silence*. XP (and so
 * the level) is reversible by design, and the "no loss pressure" guardrail
 * forbids ever telling someone their streak or level went down.
 *
 * Values live in localStorage: the server stores no level (it is derived
 * from XP by `levelForXp`) and no "already celebrated" marker, so the
 * comparison point can only be local. A cleared browser simply means the
 * next rise isn't announced — the same graceful degradation as a first run.
 */
export type ValueChange = "first" | "up" | "down" | "same";

/**
 * How `current` compares to the last value seen on this device. "first"
 * (nothing stored yet) is deliberately distinct from "up": a fresh device
 * must record where the user already is without announcing it.
 */
export function compareToLastKnown(
  previous: number | null,
  current: number,
): ValueChange {
  if (previous === null) return "first";
  if (current > previous) return "up";
  if (current < previous) return "down";
  return "same";
}

const PREFIX = "loomkeep.lastKnown.";

/** Null when nothing is stored, unreadable, or not a number. */
export function readLastKnown(key: string): number | null {
  if (typeof localStorage === "undefined") return null;

  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw === null) return null;

    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

export function writeLastKnown(key: string, value: number): void {
  if (typeof localStorage === "undefined") return;

  try {
    localStorage.setItem(PREFIX + key, String(value));
  } catch {
    // Private mode or a full quota: losing the marker only costs a missed
    // announcement, never correctness — nothing to report to the user.
  }
}
