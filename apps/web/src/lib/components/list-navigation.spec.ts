import { describe, expect, it } from "vitest";
import { getEnabledOptionIndex } from "./list-navigation";

const options = [{}, { disabled: true }, {}, { disabled: true }];

describe("list keyboard navigation", () => {
  it("moves through enabled options and wraps", () => {
    expect(getEnabledOptionIndex(options, 0, "next")).toBe(2);
    expect(getEnabledOptionIndex(options, 2, "next")).toBe(0);
    expect(getEnabledOptionIndex(options, 0, "previous")).toBe(2);
  });

  it("supports first and last navigation", () => {
    expect(getEnabledOptionIndex(options, 2, "first")).toBe(0);
    expect(getEnabledOptionIndex(options, 0, "last")).toBe(2);
  });

  it("returns no active option for empty or fully disabled results", () => {
    expect(getEnabledOptionIndex([], -1, "first")).toBe(-1);
    expect(getEnabledOptionIndex([{ disabled: true }], -1, "next")).toBe(-1);
  });
});
