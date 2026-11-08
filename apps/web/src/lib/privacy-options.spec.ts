import { Domain, VisibilityAudience, VisibilityFacet } from "@loomkeep/shared";
import { describe, expect, it } from "vitest";
import { commonAudience } from "./privacy-options";

const { FRIENDS, PUBLIC } = VisibilityAudience;

describe("commonAudience", () => {
  const table: Partial<Record<Domain, VisibilityAudience>> = {
    [Domain.MEDIA]: FRIENDS,
    [Domain.GAMES]: FRIENDS,
    [Domain.BOOKS]: PUBLIC,
  };
  const audienceOf = (domain: Domain) => table[domain] ?? FRIENDS;

  it("returns the audience the domains share", () => {
    expect(
      commonAudience(
        audienceOf,
        [Domain.MEDIA, Domain.GAMES],
        VisibilityFacet.LIBRARY,
      ),
    ).toBe(FRIENDS);
  });

  it("returns null when the domains differ", () => {
    expect(
      commonAudience(
        audienceOf,
        [Domain.MEDIA, Domain.BOOKS],
        VisibilityFacet.LIBRARY,
      ),
    ).toBeNull();
  });
});
