import type { CalendarEntryDto } from "@loomkeep/shared";
import { buildCalendarIcs } from "./ics.util";

function entry(overrides: Partial<CalendarEntryDto> = {}): CalendarEntryDto {
  return {
    mediaItem: {
      id: "media-1",
      type: "SERIES",
      title: "Severance",
      posterUrl: null,
      canonicalSource: "TMDB",
      sourceId: "12345",
    },
    seasonNumber: 2,
    episodeNumber: 3,
    episodeTitle: null,
    airDate: "2026-08-15T00:00:00.000Z",
    ...overrides,
  };
}

describe("buildCalendarIcs", () => {
  it("wraps an empty feed in a valid VCALENDAR", () => {
    const ics = buildCalendarIcs([]);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).not.toContain("BEGIN:VEVENT");
  });

  it("renders one all-day VEVENT per entry with season/episode code", () => {
    const ics = buildCalendarIcs([entry()]);
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("SUMMARY:Severance S02E03");
    expect(ics).toContain("DTSTART;VALUE=DATE:20260815");
    expect(ics).not.toContain("DESCRIPTION:");
  });

  it("includes the episode title as DESCRIPTION when present", () => {
    const ics = buildCalendarIcs([entry({ episodeTitle: "Cold Harbor" })]);
    expect(ics).toContain("DESCRIPTION:Cold Harbor");
  });

  it("escapes commas, semicolons and backslashes in text fields", () => {
    const ics = buildCalendarIcs([
      entry({ mediaItem: { ...entry().mediaItem, title: "Foo; Bar, Baz\\" } }),
    ]);
    expect(ics).toContain("SUMMARY:Foo\\; Bar\\, Baz\\\\ S02E03");
  });

  it("uses a stable UID per media item/season/episode so re-fetching doesn't duplicate events", () => {
    const ics1 = buildCalendarIcs([entry()]);
    const ics2 = buildCalendarIcs([entry()]);
    const uid = /UID:([^\r\n]+)/.exec(ics1)?.[1];
    expect(uid).toBe(/UID:([^\r\n]+)/.exec(ics2)?.[1]);
  });

  it("uses CRLF line endings", () => {
    const ics = buildCalendarIcs([entry()]);
    expect(ics.includes("\r\n")).toBe(true);
    expect(ics.split("\n").every((line) => line === "" || line.endsWith("\r"))).toBe(
      true,
    );
  });
});
