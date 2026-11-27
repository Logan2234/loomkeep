import { describe, expect, it } from "vitest";
import { lifeYears } from "./life-years";

describe("lifeYears", () => {
  it("gives the birth year, and the death year when there is one", () => {
    expect(lifeYears("1967-10-03", null)).toBe("1967");
    expect(lifeYears("1929-10-21", "2018-01-22")).toBe("1929 – 2018");
    expect(lifeYears(null, "2018-01-22")).toBe("† 2018");
    expect(lifeYears(null, null)).toBeNull();
  });
});
