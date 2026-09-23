import { Domain } from "@loomkeep/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "./auth.svelte";
import { isDomainEnabled, orderedDomains } from "./domains";

// Unleash's live flags, the only input here that isn't the user itself.
const { isEnabled } = vi.hoisted(() => ({ isEnabled: vi.fn(() => false) }));
vi.mock("./feature-flags-live.svelte", () => ({ liveFlags: { isEnabled } }));

describe("isDomainEnabled", () => {
  beforeEach(() => {
    isEnabled.mockReturnValue(false);
    auth.isPremium = false;
    auth.user = {
      enabledDomains: [Domain.MEDIA, Domain.MUSIC],
    } as never;
  });

  it("follows the user's own choice", () => {
    expect(isDomainEnabled(Domain.MEDIA)).toBe(true);
    expect(isDomainEnabled(Domain.BOOKS)).toBe(false);
  });

  it("excludes a domain under deployment-wide maintenance", () => {
    isEnabled.mockImplementation(
      ((flag: string) => flag === `MAINTENANCE_${Domain.MEDIA}`) as never,
    );

    expect(isDomainEnabled(Domain.MEDIA)).toBe(false);
  });

  // The 403 loop: the stored choice can still name a premium domain from
  // before it was gated, and the API refuses it while the front offers it.
  it("excludes a premium domain a free account still has stored", () => {
    isEnabled.mockImplementation(
      ((flag: string) => flag === "premium-features") as never,
    );

    expect(isDomainEnabled(Domain.MUSIC)).toBe(false);
    expect(isDomainEnabled(Domain.MEDIA)).toBe(true);
  });

  it("keeps that domain for a premium account", () => {
    isEnabled.mockImplementation(
      ((flag: string) => flag === "premium-features") as never,
    );
    auth.isPremium = true;

    expect(isDomainEnabled(Domain.MUSIC)).toBe(true);
  });

  it("keeps everything enabled before the profile has loaded", () => {
    auth.user = null;

    expect(isDomainEnabled(Domain.BOOKS)).toBe(true);
  });
});

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
