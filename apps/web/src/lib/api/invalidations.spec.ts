import { describe, expect, it } from "vitest";
import { invalidate } from "./invalidations";
import { keys } from "./keys";

describe("invalidate.libraryEntry", () => {
  // Adding, changing or removing a work from its page only refetched that
  // page: back in the library within the 30 s staleTime, the list, its counts
  // and the home widgets still showed the old state (audit 2026-11-17, BUG-49).
  it("refreshes the library alongside the page, as quick add does", () => {
    const detail = ["books", "detail", "OL1W"] as const;

    expect(invalidate.libraryEntry(detail)).toEqual([
      detail,
      keys.library.all(),
    ]);
  });
});

describe("invalidate.all", () => {
  it("joins what several entities touched", () => {
    expect(
      invalidate.all(invalidate.lists(), invalidate.sessionTimer()),
    ).toEqual([keys.lists.editable(), keys.sessionTimer.current()]);
  });
});
