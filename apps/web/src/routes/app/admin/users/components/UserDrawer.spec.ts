import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("UserDrawer activity loading", () => {
  it("loads each heavy activity domain only when its modal opens", () => {
    const source = readFileSync(
      new URL("./UserDrawer.svelte", import.meta.url),
      "utf8",
    );

    for (const kind of [
      "reviews",
      "comments",
      "followers",
      "following",
      "lists",
      "reports",
    ]) {
      expect(source).toContain(`enabled: activeModal === "${kind}"`);
    }
  });
});
