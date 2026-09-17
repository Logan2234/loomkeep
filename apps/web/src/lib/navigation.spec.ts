import { Domain } from "@loomkeep/shared";
import { afterEach, describe, expect, it } from "vitest";
import { auth } from "./auth.svelte";
import {
  resolveShortcutChoices,
  visibleNavItems,
  visibleNavSections,
} from "./navigation";

afterEach(() => {
  auth.user = null;
});

describe("mobile shortcut choices", () => {
  it("includes social destinations when their features are available", () => {
    const choices = resolveShortcutChoices({
      isDomainEnabled: () => true,
      isAdmin: false,
      socialEnabled: true,
      gamificationEnabled: true,
    });

    expect(choices.map((choice) => choice.id)).toEqual([
      "home",
      "search",
      "media",
      "games",
      "books",
      "music",
      "calendar",
      "stats",
      "leaderboard",
      "feed",
      "profile",
      "settings",
    ]);
  });
});

describe("domain display order", () => {
  const opts = {
    isDomainEnabled: () => true,
    isAdmin: false,
    socialEnabled: true,
    gamificationEnabled: true,
  };

  // Scoped to the Library section specifically (the only one where every
  // item is domain-tagged) — Tracking's Calendar entry also carries a
  // `domain` (it's gated on MEDIA being enabled), so filtering the flat
  // item list by `item.domain` alone would pull it in too.
  function libraryHrefs(): string[] {
    const library = visibleNavSections(opts).find((section) =>
      section.items.every((item) => item.domain),
    );
    return (library?.items ?? []).map((item) => item.href);
  }

  it("keeps the canonical order with no saved preference", () => {
    expect(libraryHrefs()).toEqual([
      "/app/media",
      "/app/games",
      "/app/books",
      "/app/music",
      "/app/podcasts",
      "/app/boardgames",
    ]);
  });

  it("reorders the Library section to the user's saved preference", () => {
    auth.user = {
      domainOrder: [Domain.MUSIC, Domain.MEDIA, Domain.BOOKS, Domain.GAMES],
    } as never;

    expect(libraryHrefs()).toEqual([
      "/app/music",
      "/app/media",
      "/app/books",
      "/app/games",
      "/app/podcasts",
      "/app/boardgames",
    ]);
  });

  it("never reorders a mixed section like Tracking, even with a saved preference", () => {
    auth.user = { domainOrder: [Domain.MUSIC, Domain.MEDIA] } as never;

    const trackingHrefs = visibleNavItems(opts)
      .filter(
        (item) =>
          item.href.startsWith("/app/calendar") ||
          item.href.startsWith("/app/stats"),
      )
      .map((item) => item.href);

    expect(trackingHrefs).toEqual(["/app/calendar", "/app/stats"]);
  });
});
