import { Domain } from "@loomkeep/shared";
import { describe, expect, it } from "vitest";
import { resolveQuickLinks } from "./quick-links";
import type { HomeGate } from "./widgets";

const gate: HomeGate = {
  isDomainEnabled: (d) => d === Domain.MEDIA,
  socialEnabled: false,
  gamificationEnabled: false,
  isAdmin: false,
};

describe("resolveQuickLinks", () => {
  it("keeps app screens and web addresses, in order", () => {
    const out = resolveQuickLinks(
      [
        { kind: "url", url: "https://jellyfin.example.com", label: "Jellyfin" },
        { kind: "app", id: "calendar" },
      ],
      gate,
    );

    expect(out.map((l) => [l.href, l.external])).toEqual([
      ["https://jellyfin.example.com", true],
      ["/app/calendar", false],
    ]);
  });

  it("drops a screen the user can't reach and an unknown one", () => {
    const out = resolveQuickLinks(
      [
        { kind: "app", id: "games" },
        { kind: "app", id: "feed" },
        { kind: "app", id: "gone" },
      ],
      gate,
    );

    expect(out).toEqual([]);
  });

  it("never renders an address that isn't http(s)", () => {
    const out = resolveQuickLinks(
      [{ kind: "url", url: "javascript:alert(1)", label: "x" }],
      gate,
    );

    expect(out).toEqual([]);
  });
});
