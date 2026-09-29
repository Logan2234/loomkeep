import { describe, expect, it } from "vitest";
import { quickAddTarget } from "./quick-add";

describe("quickAddTarget", () => {
  it("reads a work page for each domain", () => {
    expect(quickAddTarget("/app/media/series/95396")).toEqual({
      domain: "MEDIA",
      type: "SERIES",
      id: "95396",
    });
    expect(quickAddTarget("/app/games/1145360")).toEqual({
      domain: "GAMES",
      id: "1145360",
    });
    expect(quickAddTarget("/app/books/OL893415W")).toEqual({
      domain: "BOOKS",
      id: "OL893415W",
    });
  });

  it("leaves any other page to open as is", () => {
    expect(quickAddTarget("/app/lists/abc")).toBeNull();
    expect(quickAddTarget("/app/u/alice")).toBeNull();
    expect(quickAddTarget("/app/media/series/95396/season/1")).toBeNull();
  });
});
