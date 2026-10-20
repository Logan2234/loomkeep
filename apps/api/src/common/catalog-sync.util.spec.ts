import { vi } from "vitest";
import { CATALOG_SYNC_TTL_MS, isCatalogFresh } from "./catalog-sync.util";

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
