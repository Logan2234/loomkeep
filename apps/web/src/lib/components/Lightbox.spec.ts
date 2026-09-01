import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Lightbox", () => {
  it("sends the embedding page origin to the YouTube player", () => {
    const source = readFileSync(
      new URL("./Lightbox.svelte", import.meta.url),
      "utf8",
    );

    expect(source).toContain(
      'referrerpolicy="strict-origin-when-cross-origin"',
    );
  });
});
