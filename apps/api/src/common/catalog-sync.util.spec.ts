import { vi } from "vitest";
import {
  assertSomeRefreshed,
  CATALOG_SYNC_TTL_MS,
  isCatalogFresh,
  notFailedSince,
  summarizeRefresh,
} from "./catalog-sync.util";

describe("catalogue freshness", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-05T12:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("keeps the cache fresh until exactly 24 hours after its last sync", () => {
    expect(CATALOG_SYNC_TTL_MS).toBe(24 * 60 * 60 * 1000);
    expect(isCatalogFresh(new Date("2026-10-04T12:00:00.001Z"))).toBe(true);
    expect(isCatalogFresh(new Date("2026-10-04T12:00:00Z"))).toBe(false);
    expect(isCatalogFresh(new Date("2026-10-04T11:59:59Z"))).toBe(false);
  });
});

describe("refresh outcome", () => {
  it("leaves out items that failed since the given date", () => {
    const since = new Date("2026-11-14T12:00:00Z");

    expect(notFailedSince(since)).toEqual({
      OR: [{ syncFailedAt: null }, { syncFailedAt: { lt: since } }],
    });
  });

  it("summarizes a run with its failures", () => {
    const summarize = summarizeRefresh("book item");

    expect(summarize({ refreshed: 0, failed: 0 })).toBe("Nothing to refresh");
    expect(summarize({ refreshed: 3, failed: 0 })).toBe(
      "3/3 book item(s) refreshed",
    );
    expect(summarize({ refreshed: 3, failed: 2 })).toBe(
      "3/5 book item(s) refreshed, 2 failed",
    );
  });

  // A run where every attempt failed is an outage, not "nothing to do"
  // (audit 2026-11-14, OBS-01).
  it("fails a run where every attempt failed, never one that did nothing", () => {
    expect(() =>
      assertSomeRefreshed({ refreshed: 0, failed: 4 }, "book"),
    ).toThrow("Every book refresh failed (4)");
    expect(assertSomeRefreshed({ refreshed: 0, failed: 0 }, "book")).toEqual({
      refreshed: 0,
      failed: 0,
    });
    expect(assertSomeRefreshed({ refreshed: 1, failed: 4 }, "book")).toEqual({
      refreshed: 1,
      failed: 4,
    });
  });
});
