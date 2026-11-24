import { toRatingStep } from "./rating-step.validator";

describe("toRatingStep", () => {
  it("keeps a rating already on the half-point grid", () => {
    expect(toRatingStep(7)).toBe(7);
    expect(toRatingStep(7.5)).toBe(7.5);
    expect(toRatingStep(0)).toBe(0);
    expect(toRatingStep(10)).toBe(10);
  });

  it("snaps an off-grid score to the nearest half point", () => {
    expect(toRatingStep(7.3)).toBe(7.5);
    expect(toRatingStep(7.2)).toBe(7);
    expect(toRatingStep(8.75)).toBe(9);
  });

  it("clamps a score outside 0–10", () => {
    expect(toRatingStep(12)).toBe(10);
    expect(toRatingStep(-1)).toBe(0);
  });
});
