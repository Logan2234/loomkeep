import type { ApiV1LibraryEntryDto } from "@loomkeep/shared";
import { compareEntries, statusesFor } from "./library-v1.service";

describe("statusesFor", () => {
  it("turns phases back into each domain's own statuses", () => {
    expect(statusesFor("MEDIA", ["DONE"])).toEqual(["COMPLETED", "UP_TO_DATE"]);
    expect(statusesFor("BOOKS", ["IN_PROGRESS", "PLANNED"])).toEqual([
      "TO_READ",
      "READING",
    ]);
  });

  it("leaves a domain out when none of its statuses match", () => {
    expect(statusesFor("MUSIC", ["IN_PROGRESS"])).toEqual([]);
  });

  it("applies no filter without phases", () => {
    expect(statusesFor("GAMES", undefined)).toBeUndefined();
  });
});

describe("compareEntries", () => {
  const entry = (
    title: string,
    addedAt: string,
    rating: number | null = null,
  ) =>
    ({
      addedAt,
      rating,
      finishedAt: null,
      work: { title },
    }) as ApiV1LibraryEntryDto;

  it("keeps each sort's natural order when merging domains", () => {
    const a = entry("Arrival", "2026-09-01T00:00:00Z", 8);
    const b = entry("Hades", "2026-09-02T00:00:00Z", null);

    expect([a, b].sort((x, y) => compareEntries("added", x, y))).toEqual([
      b,
      a,
    ]);
    expect([b, a].sort((x, y) => compareEntries("title", x, y))).toEqual([
      a,
      b,
    ]);
    expect([b, a].sort((x, y) => compareEntries("rating", x, y))).toEqual([
      a,
      b,
    ]);
  });
});
