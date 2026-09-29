import { describe, expect, it } from "vitest";
import { sessionPeriodMinutes } from "./session-period.util";

describe("sessionPeriodMinutes", () => {
  it("builds a Monday-to-Sunday activity series in the account timezone", () => {
    const result = sessionPeriodMinutes(
      [
        {
          occurredAt: new Date("2026-09-14T12:00:00.000Z"),
          durationMinutes: 30,
        },
        {
          occurredAt: new Date("2026-09-14T18:00:00.000Z"),
          durationMinutes: 45,
        },
        {
          occurredAt: new Date("2026-09-16T08:00:00.000Z"),
          durationMinutes: 60,
        },
        {
          occurredAt: new Date("2026-09-01T12:00:00.000Z"),
          durationMinutes: 20,
        },
      ],
      "Europe/Paris",
      new Date("2026-09-17T12:00:00.000Z"),
    );

    expect(result).toEqual({
      weekMinutes: 135,
      weekSessions: 3,
      monthMinutes: 155,
      weekDays: [
        { date: "2026-09-14", durationMinutes: 75, sessionCount: 2 },
        { date: "2026-09-15", durationMinutes: 0, sessionCount: 0 },
        { date: "2026-09-16", durationMinutes: 60, sessionCount: 1 },
        { date: "2026-09-17", durationMinutes: 0, sessionCount: 0 },
        { date: "2026-09-18", durationMinutes: 0, sessionCount: 0 },
        { date: "2026-09-19", durationMinutes: 0, sessionCount: 0 },
        { date: "2026-09-20", durationMinutes: 0, sessionCount: 0 },
      ],
    });
  });
});
