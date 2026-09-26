import { describe, expect, it } from "vitest";
import {
  filtersToSearchParams,
  sameFilters,
  savedViewHref,
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
        sort: "title",
        order: "asc",
      }).toString(),
    ).toBe(
      "q=zelda&status=PLAYING%2CBACKLOG&fav=1&type=MOVIE&sort=title&order=asc",
    );
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
});
