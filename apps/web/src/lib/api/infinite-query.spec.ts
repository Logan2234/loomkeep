import { describe, expect, it } from "vitest";
import { flattenInfinitePages } from "./infinite-query.svelte";

describe("flattenInfinitePages", () => {
  it("drops missing items instead of exposing them to page components", () => {
    const pages = [{ items: [undefined, { id: "user-1" }] }];

    expect(flattenInfinitePages(pages, (page) => page.items)).toEqual([
      { id: "user-1" },
    ]);
  });

  it("treats a missing items collection as an empty page", () => {
    const pages = [{}] as { items?: { id: string }[] }[];

    expect(flattenInfinitePages(pages, (page) => page.items)).toEqual([]);
  });
});
