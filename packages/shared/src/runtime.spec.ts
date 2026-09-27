import { describe, expect, it } from "vitest";
import { episodeRuntimeFor, isRuntimeKnown, runtimeFor } from "./runtime";

describe("runtimeFor", () => {
  it("uses the real runtime when known", () => {
    expect(runtimeFor("MOVIE", 142)).toBe(142);
  });

  it("falls back to the per-type default when unknown", () => {
    expect(runtimeFor("MOVIE", null)).toBe(110);
    expect(runtimeFor("SERIES", 0)).toBe(42);
    expect(runtimeFor("ANIME", null)).toBe(24);
  });
});

describe("episodeRuntimeFor", () => {
  it("prefers the episode's own runtime over the title's average", () => {
    expect(episodeRuntimeFor("SERIES", 58, 47)).toBe(58);
  });

  it("falls back to the title's average, then to the per-type default", () => {
    expect(episodeRuntimeFor("SERIES", null, 47)).toBe(47);
    expect(episodeRuntimeFor("SERIES", 0, null)).toBe(42);
  });
});

describe("isRuntimeKnown", () => {
  it("is false only when neither the episode nor the title has a length", () => {
    expect(isRuntimeKnown(58, null)).toBe(true);
    expect(isRuntimeKnown(null, 47)).toBe(true);
    expect(isRuntimeKnown(0, null)).toBe(false);
  });
});
