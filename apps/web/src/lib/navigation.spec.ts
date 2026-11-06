import { Domain } from "@loomkeep/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { auth } from "./auth.svelte";
import {
  isPhoneTabRoot,
  resolveBottomShortcuts,
  resolveLibraryDomains,
  resolveMenuGroups,
  resolveShortcutChoices,
  scrollUpOnReselect,
  visibleNavItems,
  visibleNavSections,
} from "./navigation";

afterEach(() => {
  auth.user = null;
});

describe("mobile shortcut choices", () => {
  it("leaves the domains to Library, and Messages and Alerts to the edge tab", () => {
    expect(
      resolveShortcutChoices({
        isDomainEnabled: () => true,
        isAdmin: false,
        socialEnabled: false,
        gamificationEnabled: false,
      }).map((choice) => choice.id),
    ).toEqual(["home", "search", "calendar", "stats", "profile", "settings"]);
  });

  it("includes social destinations when their features are available", () => {
    const choices = resolveShortcutChoices({
      isDomainEnabled: () => true,
      isAdmin: true,
      socialEnabled: true,
      gamificationEnabled: true,
    });

    expect(choices.map((choice) => choice.id)).toEqual([
      "home",
      "search",
      "calendar",
      "stats",
      "leaderboard",
      "feed",
      "profile",
      "settings",
      "admin",
    ]);
  });
});

describe("resolveBottomShortcuts", () => {
  const opts = { isDomainEnabled: () => true, isAdmin: false };
  const bar = (ids: string[]) =>
    resolveBottomShortcuts(ids, opts).map((d) => d.id);

  it("puts Library at the centre", () => {
    expect(bar(["home", "search", "calendar", "profile"])).toEqual([
      "home",
      "search",
      "library",
      "calendar",
      "profile",
    ]);
    expect(bar(["home", "search"])).toEqual(["home", "library", "search"]);
  });

  it("puts it just right of the centre when the others are odd", () => {
    expect(bar(["home", "search", "stats"])).toEqual([
      "home",
      "search",
      "library",
      "stats",
    ]);
  });

  it("keeps it centred among what's left once a tab is gated out", () => {
    expect(bar(["home", "admin", "search"])).toEqual([
      "home",
      "library",
      "search",
    ]);
  });
});

describe("resolveLibraryDomains", () => {
  it("offers the enabled domains in the user's order, without the planned ones", () => {
    auth.user = {
      domainOrder: [Domain.MUSIC, Domain.GAMES, Domain.MEDIA, Domain.BOOKS],
    } as never;

    expect(
      resolveLibraryDomains({
        isDomainEnabled: (d) => d !== Domain.GAMES,
      }).map((d) => d.id),
    ).toEqual(["music", "media", "books"]);
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

describe("calendar visibility", () => {
  const calendarShown = (enabled: Domain[]) =>
    visibleNavItems({
      isDomainEnabled: (d) => enabled.includes(d),
      socialEnabled: false,
      gamificationEnabled: false,
    }).some((item) => item.href === "/app/calendar");

  it("stays while either video or games is on, and goes when both are off", () => {
    expect(calendarShown([Domain.GAMES])).toBe(true);
    expect(calendarShown([Domain.MEDIA])).toBe(true);
    expect(calendarShown([Domain.BOOKS, Domain.MUSIC])).toBe(false);
  });
});

describe("scrollUpOnReselect", () => {
  const reselect = (href: string, url: string) => {
    const event = { preventDefault: vi.fn() } as unknown as MouseEvent;
    const scrollTo = vi.fn();
    vi.stubGlobal("scrollTo", scrollTo);
    scrollUpOnReselect(event, href, new URL(url, "https://loomkeep.test"));
    vi.unstubAllGlobals();
    return {
      prevented: vi.mocked(event.preventDefault).mock.calls.length,
      scrolled: scrollTo.mock.calls.length,
    };
  };

  it("scrolls up without navigating on the tab's own page", () => {
    expect(reselect("/app/stats", "/app/stats")).toEqual({
      prevented: 1,
      scrolled: 1,
    });
  });

  it("leaves a normal link on a page under the tab", () => {
    expect(reselect("/app/stats", "/app/stats/year")).toEqual({
      prevented: 0,
      scrolled: 0,
    });
  });

  it("leaves a normal link when filters are in the URL, which clears them", () => {
    expect(reselect("/app/search", "/app/search?q=dune")).toEqual({
      prevented: 0,
      scrolled: 0,
    });
  });
});

describe("resolveMenuGroups and the bottom bar", () => {
  const opts = { isDomainEnabled: () => true, isAdmin: true };
  const ids = (bar: string[]) =>
    resolveMenuGroups(opts, bar).flatMap((g) => g.items.map((d) => d.id));

  it("offers Home and Search when the bar leaves them out", () => {
    const menu = ids(["calendar", "stats"]);
    expect(menu).toContain("home");
    expect(menu).toContain("search");
  });

  it("doesn't repeat Home and Search when the bar carries them", () => {
    const menu = ids(["home", "search", "calendar", "profile"]);
    expect(menu).not.toContain("home");
    expect(menu).not.toContain("search");
  });

  it("leaves the domains to Library and the alerts to the edge tab", () => {
    expect(ids([])).toEqual([
      "home",
      "search",
      "calendar",
      "stats",
      "settings",
      "admin",
    ]);
  });
});

describe("isPhoneTabRoot", () => {
  const bar = ["home", "search", "calendar", "profile"];

  it("knows the pages a tab opens directly", () => {
    expect(isPhoneTabRoot("/app/calendar", bar)).toBe(true);
    expect(isPhoneTabRoot("/app/games", bar)).toBe(true);
    expect(isPhoneTabRoot("/app/notifications", bar)).toBe(true);
  });

  it("leaves out a page the bar doesn't hold, and pages under a tab", () => {
    expect(isPhoneTabRoot("/app/stats", bar)).toBe(false);
    expect(isPhoneTabRoot("/app/stats", [...bar, "stats"])).toBe(true);
    expect(isPhoneTabRoot("/app/settings/appearance", bar)).toBe(false);
  });
});
