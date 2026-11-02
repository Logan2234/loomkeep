import { beforeEach, describe, expect, it } from "vitest";
import {
  forgetSearch,
  readRecentSearches,
  rememberSearch,
} from "./recent-searches";

describe("recent searches", () => {
  beforeEach(() => localStorage.clear());

  it("keeps the six newest terms, newest first", () => {
    for (const term of ["a", "b", "c", "d", "e", "f", "g"]) {
      rememberSearch(term);
    }

    expect(readRecentSearches()).toEqual(["g", "f", "e", "d", "c", "b"]);
  });

  it("moves a term searched again back to the top, whatever its case", () => {
    rememberSearch("Dune");
    rememberSearch("Alien");

    expect(rememberSearch(" dune ")).toEqual(["dune", "Alien"]);
  });

  it("ignores an empty search and forgets a term on request", () => {
    rememberSearch("Dune");

    expect(rememberSearch("   ")).toEqual(["Dune"]);
    expect(forgetSearch("Dune")).toEqual([]);
  });

  it("survives something unreadable in storage", () => {
    localStorage.setItem("lk-recent-searches", "{");

    expect(readRecentSearches()).toEqual([]);
  });
});
