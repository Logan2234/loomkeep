import type { ApiV1HistoryEventDto } from "@loomkeep/shared";
import { describe, expect, it } from "vitest";
import { ValidationException } from "../../common/validation.exception";
import { historyRange, newestFirst } from "./history-v1.service";

describe("historyRange", () => {
  it("includes the whole day of a bare end date", () => {
    expect(historyRange("2026-09-01", "2026-09-30")).toEqual({
      gte: new Date("2026-09-01T00:00:00Z"),
      lt: new Date("2026-10-01T00:00:00Z"),
    });
  });

  it("excludes an end date-time itself", () => {
    expect(historyRange(undefined, "2026-09-30T12:00:00Z")).toEqual({
      gte: undefined,
      lt: new Date("2026-09-30T12:00:00Z"),
    });
  });

  it("rejects an end that isn't after the start", () => {
    expect(() => historyRange("2026-09-30", "2026-09-29")).toThrow(
      ValidationException,
    );
  });
});

describe("newestFirst", () => {
  const event = (id: string, date: string | null) =>
    ({ id, date }) as ApiV1HistoryEventDto;

  it("puts the newest first and undated events last", () => {
    const events = [
      event("a", null),
      event("b", "2026-09-01T00:00:00.000Z"),
      event("c", "2026-09-02T00:00:00.000Z"),
    ];
    expect(events.sort(newestFirst).map((e) => e.id)).toEqual(["c", "b", "a"]);
  });

  it("breaks a tie on the id, so a merge across tables stays stable", () => {
    const date = "2026-09-01T00:00:00.000Z";
    expect(
      [event("a", date), event("b", date)].sort(newestFirst).map((e) => e.id),
    ).toEqual(["b", "a"]);
  });
});
