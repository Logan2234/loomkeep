import { describe, expect, it } from "vitest";
import {
  formatSessionMinutes,
  localDateInput,
  sessionDateToIso,
} from "./session-presentation";

describe("session presentation", () => {
  it("formats compact durations", () => {
    expect(formatSessionMinutes(45)).toBe("45 min");
    expect(formatSessionMinutes(60)).toBe("1 h");
    expect(formatSessionMinutes(135)).toBe("2 h 15 min");
  });

  it("keeps date inputs on the local calendar day", () => {
    expect(localDateInput(new Date(2026, 8, 26, 23, 30))).toBe("2026-09-26");
    expect(sessionDateToIso("2026-09-26")).toContain("2026-09-26");
  });
});
