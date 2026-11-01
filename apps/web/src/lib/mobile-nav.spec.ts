import { describe, expect, it } from "vitest";
import { parseShortcuts } from "./mobile-nav.svelte";

describe("parseShortcuts", () => {
  const defaults = parseShortcuts(null);

  it("defaults to five cases, with Messages and Alerts", () => {
    expect(defaults).toEqual(["home", "search", "menu", "messages", "alerts"]);
  });

  it("keeps a valid stored bar, in its order", () => {
    const bar = ["menu", "alerts", "home"];
    expect(parseShortcuts(JSON.stringify(bar))).toEqual(bar);
  });

  it.each([
    ["broken JSON", "{"],
    ["no menu", JSON.stringify(["home", "search", "alerts"])],
    ["too few", JSON.stringify(["menu", "home"])],
    ["too many", JSON.stringify(["menu", "a", "b", "c", "d", "e"])],
    ["not strings", JSON.stringify(["menu", 1, 2])],
  ])("falls back to the defaults on %s", (_label, stored) => {
    expect(parseShortcuts(stored)).toEqual(defaults);
  });
});
