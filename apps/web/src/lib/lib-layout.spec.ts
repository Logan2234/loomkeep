import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

// src/lib is sorted by domain (CLAUDE.md, Web): a file goes in its domain's
// folder (books/, lists/…), ui/ when it is generic, shell/ for the app's
// frame. Only the specs that cover the whole of lib/ sit at its root.
const ROOT_SPECS = [
  "lib-layout.spec.ts",
  "messages-fr.spec.ts",
  "module-level-messages.spec.ts",
];

describe("src/lib layout", () => {
  const entries = readdirSync(new URL("./", import.meta.url), {
    withFileTypes: true,
  });

  it("keeps no file flat in lib/", () => {
    expect(
      entries
        .filter((entry) => entry.isFile() && !ROOT_SPECS.includes(entry.name))
        .map((entry) => entry.name),
    ).toEqual([]);
  });

  it("has no catch-all components/ folder", () => {
    expect(
      entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name),
    ).not.toContain("components");
  });
});
