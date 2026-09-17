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
    writeReviewDraft("MEDIA", "m1", draft);
    expect(readReviewDraft("MEDIA", "m1")).toEqual(draft);
    expect(readReviewDraft("MEDIA", "m2")).toBeNull();
    expect(readReviewDraft("GAME", "m1")).toBeNull();
  });

  it("forgets a cleared draft", () => {
    writeReviewDraft("MEDIA", "m1", draft);
    clearReviewDraft("MEDIA", "m1");
    expect(readReviewDraft("MEDIA", "m1")).toBeNull();
  });

  it("ignores a corrupted entry", () => {
    store.set("loomkeep.reviewDraft.MEDIA:m1", "{not json");
    expect(readReviewDraft("MEDIA", "m1")).toBeNull();
    store.set("loomkeep.reviewDraft.MEDIA:m1", JSON.stringify({ rating: "x" }));
    expect(readReviewDraft("MEDIA", "m1")).toBeNull();
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
    expect(() => writeReviewDraft("MEDIA", "m1", draft)).not.toThrow();
    expect(() => clearReviewDraft("MEDIA", "m1")).not.toThrow();
    expect(readReviewDraft("MEDIA", "m1")).toBeNull();
  });
});
