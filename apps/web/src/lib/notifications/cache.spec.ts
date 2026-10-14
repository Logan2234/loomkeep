import type { NotificationDto } from "@loomkeep/shared";
import { describe, expect, it } from "vitest";
import { daySection, entriesOf, groupByDay, mapEntries } from "./cache";

const entry = (
  id: string,
  createdAt = "2026-10-14T09:00:00",
): NotificationDto => ({
  id,
  type: "FOLLOW",
  title: "Alice",
  body: null,
  url: null,
  data: {},
  timestamp: createdAt,
  createdAt,
  readAt: null,
});

describe("mapEntries", () => {
  const read = (e: NotificationDto) => ({
    ...e,
    readAt: "2026-10-14T10:00:00Z",
  });

  it("rewrites the bell's single page", () => {
    const data = { items: [entry("a"), entry("b")], hasMore: false };

    const next = mapEntries(data, (e) => (e.id === "a" ? read(e) : null));

    expect(entriesOf(next).map((e) => [e.id, e.readAt])).toEqual([
      ["a", "2026-10-14T10:00:00Z"],
    ]);
  });

  it("rewrites every page of the history", () => {
    const data = {
      pages: [
        { items: [entry("a")], hasMore: true },
        { items: [entry("b")], hasMore: false },
      ],
      pageParams: [1, 2],
    };

    const next = mapEntries(data, (e) => (e.id === "b" ? null : e));

    expect(next).toEqual({
      pages: [
        { items: [entry("a")], hasMore: true },
        { items: [], hasMore: false },
      ],
      pageParams: [1, 2],
    });
  });

  it("leaves a query that hasn't loaded alone", () => {
    expect(mapEntries(undefined, () => null)).toBeUndefined();
  });
});

describe("groupByDay", () => {
  const now = new Date("2026-10-14T20:00:00");

  it("sorts entries by the reader's local day", () => {
    expect(daySection("2026-10-14T00:30:00", now)).toBe("today");
    expect(daySection("2026-10-13T23:59:00", now)).toBe("yesterday");
    expect(daySection("2026-10-08T12:00:00", now)).toBe("week");
    expect(daySection("2026-10-01T12:00:00", now)).toBe("older");
  });

  it("groups consecutive entries under one heading each", () => {
    const groups = groupByDay(
      [
        entry("a", "2026-10-14T19:00:00"),
        entry("b", "2026-10-14T08:00:00"),
        entry("c", "2026-10-13T08:00:00"),
        entry("d", "2026-09-01T08:00:00"),
      ],
      now,
    );

    expect(groups.map((g) => [g.section, g.entries.map((e) => e.id)])).toEqual([
      ["today", ["a", "b"]],
      ["yesterday", ["c"]],
      ["older", ["d"]],
    ]);
  });
});
