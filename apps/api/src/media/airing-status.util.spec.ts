import { isAiringFinished } from "./airing-status.util";

describe("isAiringFinished", () => {
  it("recognizes TMDB's finished statuses", () => {
    expect(isAiringFinished("Ended")).toBe(true);
    expect(isAiringFinished("Canceled")).toBe(true);
  });

  it("recognizes AniList's finished statuses", () => {
    expect(isAiringFinished("FINISHED")).toBe(true);
    expect(isAiringFinished("CANCELLED")).toBe(true);
  });

  it("treats a still-airing status as not finished", () => {
    expect(isAiringFinished("Returning Series")).toBe(false);
    expect(isAiringFinished("RELEASING")).toBe(false);
    expect(isAiringFinished("NOT_YET_RELEASED")).toBe(false);
    expect(isAiringFinished("HIATUS")).toBe(false);
  });

  it("fails safe (not finished) on an unknown or absent status", () => {
    expect(isAiringFinished("SOME_NEW_PROVIDER_STATUS")).toBe(false);
    expect(isAiringFinished(null)).toBe(false);
    expect(isAiringFinished(undefined)).toBe(false);
  });
});
