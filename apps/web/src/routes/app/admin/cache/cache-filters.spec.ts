import { adminFilterHref } from "$lib/admin-filter-url";
import { Domain } from "@loomkeep/shared";
import { describe, expect, it } from "vitest";
import { parseCacheFilters } from "./cache-filters";

describe("parseCacheFilters", () => {
  it("restores all stable cache filters from a URL", () => {
    const params = new URLSearchParams(
      "domain=BOOKS&sort=title&orphans=1&q=Dune",
    );

    expect(parseCacheFilters(params)).toEqual({
      domain: Domain.BOOKS,
      sort: "title",
      orphansOnly: true,
      search: "Dune",
    });
  });

  it("falls back to usable defaults for invalid or unavailable values", () => {
    const params = new URLSearchParams(
      "domain=PODCASTS&sort=unknown&orphans=false",
    );

    expect(parseCacheFilters(params)).toEqual({
      domain: Domain.MEDIA,
      sort: "stale",
      orphansOnly: false,
      search: "",
    });
  });

  it("round-trips filters without dropping unrelated URL parameters", () => {
    const url = new URL(
      "https://loomkeep.app/app/admin/cache?source=dashboard",
    );
    const next = new URL(
      adminFilterHref(url, {
        domain: "GAMES",
        sort: "recent",
        orphans: "1",
        q: "Zelda",
      }),
      url,
    );

    expect(next.searchParams.get("source")).toBe("dashboard");
    expect(parseCacheFilters(next.searchParams)).toEqual({
      domain: Domain.GAMES,
      sort: "recent",
      orphansOnly: true,
      search: "Zelda",
    });
  });
});
