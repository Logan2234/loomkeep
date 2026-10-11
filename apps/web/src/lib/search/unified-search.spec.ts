import type { WorkSearchHitDto } from "@loomkeep/shared";
import { describe, expect, it } from "vitest";
import { SHELF_SIZE, shelves, statusLabel } from "./unified-search";

const hit = (
  kind: WorkSearchHitDto["kind"],
  title: string,
  status: string | null = null,
): WorkSearchHitDto => ({
  kind,
  title,
  imageUrl: null,
  href: `/app/x/${title}`,
  year: null,
  isAdult: false,
  status,
});

describe("shelves", () => {
  it("follows the user's domain order, not the ranking", () => {
    const answer = {
      items: [hit("MOVIE", "Dune"), hit("BOOK", "Dune")],
      unavailable: [],
    };

    expect(
      shelves(["BOOKS", "MEDIA", "PODCASTS"], answer, true).map(
        (s) => s.domain,
      ),
    ).toEqual(["BOOKS", "MEDIA"]);
  });

  it(`keeps ${SHELF_SIZE} works a shelf, in the ranked order`, () => {
    const answer = {
      items: ["A", "B", "C", "D"].map((t) => hit("GAME", t)),
      unavailable: [],
    };

    const [shelf] = shelves(["GAMES"], answer, true);

    expect(shelf.state === "results" && shelf.hits.map((h) => h.title)).toEqual(
      ["A", "B", "C"],
    );
  });

  it("waits for a domain while the catalogues answer, then drops it if empty", () => {
    const answer = { items: [hit("MOVIE", "Dune")], unavailable: [] };

    expect(shelves(["MEDIA", "MUSIC"], answer, false)[1]).toEqual({
      domain: "MUSIC",
      state: "loading",
    });
    expect(shelves(["MEDIA", "MUSIC"], answer, true)).toHaveLength(1);
  });

  it("says which catalogue didn't answer", () => {
    const answer = { items: [], unavailable: ["MUSIC" as const] };

    expect(shelves(["MEDIA", "MUSIC"], answer, true)).toEqual([
      { domain: "MUSIC", state: "unavailable" },
    ]);
  });
});

describe("statusLabel", () => {
  it("names a status in its domain's words", () => {
    expect(statusLabel(hit("BOOK", "Dune", "READING"))).toBeTruthy();
    expect(statusLabel(hit("BOOK", "Dune"))).toBe(null);
  });
});
