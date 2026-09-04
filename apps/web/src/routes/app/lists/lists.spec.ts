import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./[id]/+page.svelte", import.meta.url),
  "utf8",
);

describe("list reordering", () => {
  it("refreshes the optimistic-lock timestamp after a successful reorder", () => {
    expect(source).toMatch(
      /await reorderListItems\([\s\S]*?\);\s*await queryClient\.refetchQueries\(\{ queryKey: detailKey \}\);/,
    );
  });
});
