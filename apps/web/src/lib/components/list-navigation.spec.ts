import { describe, expect, it } from "vitest";
import {
  getEnabledOptionIndex,
  reconcileActiveOptionValue,
} from "./list-navigation";

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

  it("reconciles an active value after async options are replaced", () => {
    const results = [
      { value: "all" },
      { value: "alice" },
      { value: "bob", disabled: true },
    ];

    expect(reconcileActiveOptionValue(results, "stale", [])).toBe("all");
    expect(reconcileActiveOptionValue(results, "alice", [])).toBe("alice");
    expect(reconcileActiveOptionValue(results, "stale", ["alice"])).toBe(
      "alice",
    );
    expect(
      reconcileActiveOptionValue([{ value: "x", disabled: true }], "x", []),
    ).toBeNull();
  });
});
