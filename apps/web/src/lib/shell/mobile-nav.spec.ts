import { describe, expect, it } from "vitest";
import {
  DEFAULT_EDGE_TAB,
  parseEdgeTabPlace,
  parseShortcuts,
} from "./mobile-nav.svelte";

describe("parseShortcuts", () => {
  const defaults = parseShortcuts(null);

  it("defaults to Home, Search, Calendar and Profile around Library", () => {
    expect(defaults).toEqual(["home", "search", "calendar", "profile"]);
  });

  it("keeps a valid stored bar, in its order", () => {
    const bar = ["stats", "home"];
    expect(parseShortcuts(JSON.stringify(bar))).toEqual(bar);
  });

  it.each([
    ["broken JSON", "{"],
    ["too few", JSON.stringify(["home"])],
    [
      "too many",
      JSON.stringify([
        "home",
        "search",
        "calendar",
        "stats",
        "feed",
        "profile",
      ]),
    ],
    ["not strings", JSON.stringify(["home", 1])],
    ["an unknown tab", JSON.stringify(["home", "rocket"])],
    ["a repeated tab", JSON.stringify(["home", "home"])],
  ])("falls back to the defaults on %s", (_label, stored) => {
    expect(parseShortcuts(stored)).toEqual(defaults);
  });

  // A bar saved before the Library tab carried "menu", and could hold
  // Messages, Alerts and domains, which aren't bar tabs any more.
  it("turns the old default bar into the new one", () => {
    expect(
      parseShortcuts(
        JSON.stringify(["home", "search", "menu", "messages", "alerts"]),
      ),
    ).toEqual(defaults);
  });

  it("keeps an old bar's own tabs, in order, and fills the freed places", () => {
    expect(
      parseShortcuts(JSON.stringify(["stats", "menu", "media", "home"])),
    ).toEqual(["stats", "home", "search"]);
  });
});

describe("parseEdgeTabPlace", () => {
  it("starts on the right, a third of the way up", () => {
    expect(parseEdgeTabPlace(null)).toEqual(DEFAULT_EDGE_TAB);
    expect(DEFAULT_EDGE_TAB).toEqual({ side: "right", y: 2 / 3 });
  });

  it("keeps a place where it was dropped", () => {
    expect(parseEdgeTabPlace(JSON.stringify({ side: "left", y: 0.4 }))).toEqual(
      { side: "left", y: 0.4 },
    );
  });

  it.each([
    ["broken JSON", "{"],
    ["no side", JSON.stringify({ y: 0.4 })],
    ["an unknown side", JSON.stringify({ side: "top", y: 0.4 })],
    ["under the bar", JSON.stringify({ side: "left", y: 0.98 })],
  ])("falls back to the default on %s", (_label, stored) => {
    expect(parseEdgeTabPlace(stored)).toEqual(DEFAULT_EDGE_TAB);
  });
});
