import { ownershipText } from "#lib/library-view.js";
import { m } from "#lib/paraglide/messages.js";
import { describe, expect, it } from "vitest";
import {
  BOOK_OWNERSHIP_STATUS_OPTIONS,
  ownershipSourceLabel,
} from "./ownership-sources";

describe("ownershipSourceLabel", () => {
  it("translates a physical format and leaves a store's name as written", () => {
    expect(ownershipSourceLabel("PAPERBACK")).toBe(
      m.ownership_format_paperback(),
    );
    expect(ownershipSourceLabel("Kindle")).toBe("Kindle");
  });

  it("reads a format in the library's ownership column", () => {
    expect(
      ownershipText(BOOK_OWNERSHIP_STATUS_OPTIONS, "PHYSICAL", "HARDCOVER"),
    ).toBe(`${m.ownership_physical()} · ${m.ownership_format_hardcover()}`);
  });
});
