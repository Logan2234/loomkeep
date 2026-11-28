import { describe, expect, it } from "vitest";
import {
  formatSessionMinutes,
  groupSessionsByCycle,
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

describe("groupSessionsByCycle", () => {
  const session = (id: string, cycle: number | null, minutes: number) => ({
    id,
    cycle,
    durationMinutes: minutes,
  });

  it("groups by cycle in first-seen order and sums each group's minutes", () => {
    const groups = groupSessionsByCycle(
      [
        session("a", 2, 30),
        session("b", null, 10),
        session("c", 2, 15),
        session("d", 1, 60),
      ],
      (s) => s.cycle,
      (cycle) => (cycle === null ? "history" : `#${cycle}`),
    );

    expect(
      groups.map((g) => [g.label, g.sessions.map((s) => s.id), g.totalMinutes]),
    ).toEqual([
      ["#2", ["a", "c"], 45],
      ["history", ["b"], 10],
      ["#1", ["d"], 60],
    ]);
  });
});
