import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  compareToLastKnown,
  readLastKnown,
  writeLastKnown,
} from "./last-known";

describe("compareToLastKnown", () => {
  it("reports a first run apart from a rise, so nothing is announced", () => {
    expect(compareToLastKnown(null, 12)).toBe("first");
  });

  it("reports a rise", () => {
    expect(compareToLastKnown(3, 4)).toBe("up");
  });

  // The guardrail this whole helper exists for: a drop is recorded, never
  // announced. XP (and so the level) is reversible by design, and losing a
  // streak must never be surfaced.
  it("reports a drop, which callers handle silently", () => {
    expect(compareToLastKnown(9, 2)).toBe("down");
  });

  it("reports no change", () => {
    expect(compareToLastKnown(7, 7)).toBe("same");
  });
});

describe("last-known storage", () => {
  let store: Map<string, string>;

  beforeEach(() => {
    store = new Map();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("round-trips a value under a namespaced key", () => {
    writeLastKnown("level:u1", 14);
    expect(readLastKnown("level:u1")).toBe(14);
    expect([...store.keys()]).toEqual(["loomkeep.lastKnown.level:u1"]);
  });

  it("keys are per subject, so two users never share a marker", () => {
    writeLastKnown("streak:u1", 5);
    expect(readLastKnown("streak:u2")).toBeNull();
  });

  it("treats an unreadable or corrupted value as nothing stored", () => {
    store.set("loomkeep.lastKnown.level:u1", "not-a-number");
    expect(readLastKnown("level:u1")).toBeNull();
  });

  it("survives storage being unavailable", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    });

    expect(() => writeLastKnown("level:u1", 3)).not.toThrow();
    expect(readLastKnown("level:u1")).toBeNull();
  });
});
