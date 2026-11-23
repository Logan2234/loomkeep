import { describe, expect, it } from "vitest";
import { keys } from "./api/keys";
import { entryTrackingInvalidates } from "./entry-tracking-mutations.svelte";

// Adding, changing or removing a work from its page only refetched that
// page: back in the library within the 30 s staleTime, the list, its counts
// and the home widgets still showed the old state (audit 2026-11-17, BUG-49).
describe("entryTrackingInvalidates", () => {
  it("refreshes the library alongside the page, as quick add does", () => {
    const detail = ["books", "detail", "OL1W"] as const;

    expect(entryTrackingInvalidates(detail)).toEqual([
      detail,
      keys.library.all(),
    ]);
  });
});
