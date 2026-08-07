import { ProfileAccess, type UserSummaryDto } from "@loomkeep/shared";
import { anonymizeAuthor, derivePseudonym } from "./pseudonym.util";

function author(over: Partial<UserSummaryDto> = {}): UserSummaryDto {
  return {
    id: "ghost-1",
    username: "ghosty",
    displayName: "Ghosty",
    profileAccess: ProfileAccess.GHOST,
    avatarUrl: "/users/ghost-1/avatar?v=1",
    ...over,
  };
}

describe("derivePseudonym", () => {
  it("is deterministic for the same author + target", () => {
    const a = derivePseudonym("u1", "MEDIA", "m1");
    const b = derivePseudonym("u1", "MEDIA", "m1");
    expect(a).toBe(b);
  });

  it("differs across targets for the same author (no cross-thread correlation)", () => {
    const a = derivePseudonym("u1", "MEDIA", "m1");
    const b = derivePseudonym("u1", "MEDIA", "m2");
    expect(a).not.toBe(b);
  });

  it("matches the expected format", () => {
    expect(derivePseudonym("u1", "MEDIA", "m1")).toMatch(/^Figurant n°\d{6}$/u);
  });
});

describe("anonymizeAuthor", () => {
  it("replaces identity for a GHOST author viewed by someone else", () => {
    const result = anonymizeAuthor(author(), "viewer-1", "MEDIA", "m1");
    expect(result.anonymized).toBe(true);
    expect(result.username).toBe("");
    expect(result.displayName).toBe(derivePseudonym("ghost-1", "MEDIA", "m1"));
  });

  it("strips the real avatar too — a photo would deanonymize the Figurant", () => {
    const result = anonymizeAuthor(author(), "viewer-1", "MEDIA", "m1");
    expect(result.avatarUrl).toBeNull();
  });

  it("is a no-op for a non-GHOST author", () => {
    const pub = author({ profileAccess: ProfileAccess.PUBLIC });
    expect(anonymizeAuthor(pub, "viewer-1", "MEDIA", "m1")).toBe(pub);
  });

  it("is a no-op when the viewer is the author themself", () => {
    const self = author();
    expect(anonymizeAuthor(self, "ghost-1", "MEDIA", "m1")).toBe(self);
  });
});
