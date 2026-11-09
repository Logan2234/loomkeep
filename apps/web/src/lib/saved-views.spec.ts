import { describe, expect, it } from "vitest";
import {
  filtersToSearchParams,
  sameFilters,
  savedViewHref,
  statusesFromParam,
} from "./saved-views";

describe("filtersToSearchParams", () => {
  it("leaves an untouched page with a bare address", () => {
    expect(
      filtersToSearchParams(
        {
          q: "  ",
          statuses: [],
          favorite: false,
          sort: "added",
          order: "desc",
        },
        "added",
      ).toString(),
    ).toBe("");
  });

  it("writes the same keys the library page reads", () => {
    expect(
      filtersToSearchParams({
        q: "zelda",
        statuses: ["PLAYING", "BACKLOG"],
        favorite: true,
        types: ["MOVIE"],
        platforms: ["Nintendo Switch"],
        sort: "title",
        order: "asc",
      }).toString(),
    ).toBe(
      "q=zelda&status=PLAYING%2CBACKLOG&fav=1&type=MOVIE&platform=Nintendo+Switch&sort=title&order=asc",
    );
  });
});

describe("filtersToSearchParams, on a page that opens on some statuses", () => {
  const defaults = ["PLAYING", "BACKLOG"];

  it("leaves the default statuses out, whatever their order", () => {
    expect(
      filtersToSearchParams(
        { statuses: ["BACKLOG", "PLAYING"] },
        undefined,
        defaults,
      ).toString(),
    ).toBe("");
  });

  it("spells out every status as `all`, read back as no status filter", () => {
    const params = filtersToSearchParams({ statuses: [] }, undefined, defaults);
    expect(params.toString()).toBe("status=all");
    expect(statusesFromParam(params.get("status"), defaults)).toEqual([]);
    expect(statusesFromParam(null, defaults)).toEqual(defaults);
  });
});

describe("sameFilters", () => {
  it("ignores how an unset field is spelled and the order of statuses", () => {
    expect(
      sameFilters(
        { statuses: ["READ", "READING"], favorite: false, sort: "added" },
        { statuses: ["READING", "READ"], order: "desc" },
        "added",
      ),
    ).toBe(true);
  });

  it("tells a changed sort or direction apart", () => {
    expect(sameFilters({ sort: "title" }, {}, "added")).toBe(false);
    expect(sameFilters({ order: "asc" }, {}, "added")).toBe(false);
  });
});

describe("savedViewHref", () => {
  it("opens the view's library with the view applied", () => {
    expect(
      savedViewHref({
        id: "v1",
        name: "Switch",
        domain: "GAMES",
        filters: { statuses: ["PLAYING"], sort: "playtime" },
        createdAt: "",
        updatedAt: "",
      }),
    ).toBe("/app/games?status=PLAYING&sort=playtime&view=v1");
  });

  it("keeps a view of every status from opening on the page's default ones", () => {
    expect(
      savedViewHref({
        id: "v2",
        name: "Tout",
        domain: "GAMES",
        filters: { statuses: [] },
        createdAt: "",
        updatedAt: "",
      }),
    ).toBe("/app/games?status=all&view=v2");
  });
});
