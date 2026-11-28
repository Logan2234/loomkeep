import { describe, expect, it } from "vitest";
import { invalidate } from "./invalidations";
import { keys } from "./keys";

describe("invalidate.libraryEntry", () => {
  // Adding, changing or removing a work from its page only refetched that
  // page: back in the library within the 30 s staleTime, the list, its counts
  // and the home widgets still showed the old state (audit 2026-11-17, BUG-49).
  it("refreshes the library alongside the page, as quick add does", () => {
    const detail = ["books", "detail", "OL1W"] as const;

    expect(invalidate.libraryEntry(detail)).toEqual(
      expect.arrayContaining([detail, keys.library.all()]),
    );
  });

  // The home widgets, the stats and the calendar showed the entry's old
  // state until their own refetch (audit 2026-11-17, REF-07).
  it("refreshes every screen that shows the entry", () => {
    expect(invalidate.libraryEntry(keys.media.detail("MOVIE", "1"))).toEqual(
      expect.arrayContaining([
        keys.home.all(),
        keys.stats.all(),
        keys.calendar.upcoming(),
      ]),
    );
  });
});

describe("invalidate.all", () => {
  it("joins what several entities touched", () => {
    expect(
      invalidate.all(invalidate.lists(), invalidate.sessionTimer()),
    ).toEqual([keys.lists.editable(), keys.sessionTimer.current()]);
  });
});
