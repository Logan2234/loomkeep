import { describe, expect, it } from "vitest";
import {
  episodeRuntimeFor,
  episodesTimeLeft,
  isRuntimeKnown,
  runtimeFor,
} from "./runtime";

describe("episodesTimeLeft", () => {
  it("adds known episode lengths and the title fallback", () => {
    expect(
      episodesTimeLeft("SERIES", 40, [
        { runtimeMin: 50 },
        { runtimeMin: null },
      ]),
    ).toEqual({ minutes: 90, estimated: false });
  });

  it("marks per-type fallback lengths as estimated", () => {
    expect(
      episodesTimeLeft("ANIME", null, [
        { runtimeMin: 20 },
        { runtimeMin: null },
      ]),
    ).toEqual({ minutes: 44, estimated: true });
    expect(episodesTimeLeft("SERIES", null, [])).toEqual({
      minutes: 0,
      estimated: false,
    });
  });
});

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
