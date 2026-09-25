import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearReviewDraft,
  readReviewDraft,
  writeReviewDraft,
} from "./review-draft";

describe("review drafts", () => {
  let store: Map<string, string>;

  beforeEach(() => {
    store = new Map();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  const draft = { rating: 7, text: "Half-written", spoilerTag: true };

  it("round-trips a draft per target", () => {
    writeReviewDraft("u1", "MEDIA", "m1", draft);
    expect(readReviewDraft("u1", "MEDIA", "m1")).toEqual(draft);
    expect(readReviewDraft("u1", "MEDIA", "m2")).toBeNull();
    expect(readReviewDraft("u1", "GAME", "m1")).toBeNull();
  });

  // A shared browser must never hand one account's unsent text to another.
  it("keeps each account's drafts apart", () => {
    writeReviewDraft("u1", "MEDIA", "m1", draft);
    expect(readReviewDraft("u2", "MEDIA", "m1")).toBeNull();
  });

  it("forgets a cleared draft", () => {
    writeReviewDraft("u1", "MEDIA", "m1", draft);
    clearReviewDraft("u1", "MEDIA", "m1");
    expect(readReviewDraft("u1", "MEDIA", "m1")).toBeNull();
  });

  it("ignores a corrupted entry", () => {
    writeReviewDraft("u1", "MEDIA", "m1", draft);
    const [key] = store.keys();
    store.set(key, "{not json");
    expect(readReviewDraft("u1", "MEDIA", "m1")).toBeNull();
    store.set(key, JSON.stringify({ rating: "x" }));
    expect(readReviewDraft("u1", "MEDIA", "m1")).toBeNull();
  });

  it("ignores a rating outside 0–10", () => {
    for (const rating of [47, -3]) {
      writeReviewDraft("u1", "MEDIA", "m1", { ...draft, rating });
      expect(readReviewDraft("u1", "MEDIA", "m1")).toBeNull();
    }
  });

  it("degrades silently when storage throws", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    });
    expect(() => writeReviewDraft("u1", "MEDIA", "m1", draft)).not.toThrow();
    expect(() => clearReviewDraft("u1", "MEDIA", "m1")).not.toThrow();
    expect(readReviewDraft("u1", "MEDIA", "m1")).toBeNull();
  });
});
