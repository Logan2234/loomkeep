import { Domain } from "@loomkeep/shared";
import { describe, expect, it } from "vitest";
import { orderedDomains } from "./domains";

describe("orderedDomains", () => {
  it("falls back to the canonical order when nothing is saved", () => {
    expect(orderedDomains(undefined)).toEqual([
      Domain.MEDIA,
      Domain.GAMES,
      Domain.BOOKS,
      Domain.MUSIC,
      Domain.PODCASTS,
      Domain.BOARDGAMES,
    ]);
  });

  it("falls back to the canonical order on an empty preference", () => {
    expect(orderedDomains([])).toEqual(orderedDomains(undefined));
  });

  it("applies a full custom order", () => {
    expect(
      orderedDomains([
        Domain.MUSIC,
        Domain.BOOKS,
        Domain.GAMES,
        Domain.MEDIA,
        Domain.BOARDGAMES,
        Domain.PODCASTS,
      ]),
    ).toEqual([
      Domain.MUSIC,
      Domain.BOOKS,
      Domain.GAMES,
      Domain.MEDIA,
      Domain.BOARDGAMES,
      Domain.PODCASTS,
    ]);
  });

  it("keeps a domain missing from the preference at the end, in canonical order", () => {
    // Saved before BOARDGAMES existed, or the user never dragged it.
    expect(orderedDomains([Domain.MUSIC, Domain.MEDIA])).toEqual([
      Domain.MUSIC,
      Domain.MEDIA,
      Domain.GAMES,
      Domain.BOOKS,
      Domain.PODCASTS,
      Domain.BOARDGAMES,
    ]);
  });
});
