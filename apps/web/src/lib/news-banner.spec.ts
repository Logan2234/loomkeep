import { describe, expect, it, vi } from "vitest";
import {
  customText,
  isExternalHref,
  isNewsBannerLive,
  newsBannerFitsPage,
  parseNewsBanner,
} from "./news-banner";

const maintenance = {
  id: "2026-10-04-db",
  key: "maintenance_scheduled",
  severity: "warning",
  dismissible: false,
  placement: "app",
  startsAt: "2026-10-01T00:00:00Z",
  endsAt: "2026-10-04T05:00:00Z",
  data: { start: "2026-10-04T01:00:00Z", end: "2026-10-04T03:00:00Z" },
};

const parse = (payload: unknown) =>
  parseNewsBanner(
    typeof payload === "string" ? payload : JSON.stringify(payload),
  );

describe("parseNewsBanner", () => {
  it("reads a complete announcement", () => {
    expect(parse(maintenance)).toEqual({
      ...maintenance,
      startsAt: new Date("2026-10-01T00:00:00Z"),
      endsAt: new Date("2026-10-04T05:00:00Z"),
      href: null,
    });
  });

  it("fills in the defaults: info, everywhere, dismissible, no window", () => {
    expect(parse({ id: "a", key: "degraded_service" })).toMatchObject({
      severity: "info",
      placement: "all",
      dismissible: true,
      startsAt: null,
      endsAt: null,
      data: {},
    });
  });

  it.each([
    ["no payload", undefined],
    ["broken JSON", "{not json"],
    ["an unknown template", { id: "a", key: "free_text" }],
    [
      "an unknown severity",
      { id: "a", key: "degraded_service", severity: "red" },
    ],
    [
      "an unknown placement",
      { id: "a", key: "degraded_service", placement: "home" },
    ],
    ["a bad date", { id: "a", key: "degraded_service", endsAt: "tomorrow" }],
    ["a custom banner with no text", { id: "a", key: "custom" }],
    [
      "a script href",
      { id: "a", key: "degraded_service", href: "javascript:alert(1)" },
    ],
    [
      "a protocol-relative href",
      { id: "a", key: "degraded_service", href: "//evil.example" },
    ],
    [
      "a template missing its data",
      {
        id: "a",
        key: "maintenance_scheduled",
        data: { start: "2026-10-04T01:00:00Z" },
      },
    ],
  ])("shows nothing for %s", (_, payload) => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(
      payload === undefined ? parseNewsBanner(undefined) : parse(payload),
    ).toBeNull();
  });
});

describe("id", () => {
  it("is derived from the content when the payload has none", () => {
    const a = parse({ id: "", key: "custom", data: { fr: "Un" } })!;
    const same = parse({ key: "custom", data: { fr: "Un" } })!;
    const edited = parse({ key: "custom", data: { fr: "Deux" } })!;

    expect(a.id).toBe(same.id);
    // Editing the text is a new announcement: a closed banner comes back.
    expect(edited.id).not.toBe(a.id);
  });
});

describe("custom banners", () => {
  const text = { fr: "Bonjour", en: "Hello", de: "Hallo" };

  it("reads the text from data, per language", () => {
    expect(parse({ id: "a", key: "custom", data: text })).toMatchObject({
      key: "custom",
      data: text,
    });
  });

  it("speaks the reader's language when it's there", () => {
    expect(customText(text, "fr")).toBe("Bonjour");
  });

  it("falls back to English, then to the first language given", () => {
    expect(customText(text, "es")).toBe("Hello");
    expect(customText({ de: "Hallo", it: "Ciao" }, "fr")).toBe("Hallo");
  });
});

describe("href", () => {
  it("accepts a site path or an http(s) URL", () => {
    for (const href of ["/app/feed", "https://status.loomkeep.app"]) {
      expect(parse({ id: "a", key: "degraded_service", href })?.href).toBe(
        href,
      );
    }
  });

  it("opens only other sites in a new tab", () => {
    expect(isExternalHref("/app/feed")).toBe(false);
    expect(isExternalHref("https://status.loomkeep.app")).toBe(true);
  });
});

describe("isNewsBannerLive", () => {
  const banner = parse(maintenance)!;

  it("waits for its start, and stops at its end", () => {
    expect(isNewsBannerLive(banner, new Date("2026-09-30T23:59:59Z"))).toBe(
      false,
    );
    expect(isNewsBannerLive(banner, new Date("2026-10-02T12:00:00Z"))).toBe(
      true,
    );
    expect(isNewsBannerLive(banner, new Date("2026-10-04T05:00:00Z"))).toBe(
      false,
    );
  });

  it("is always live without a window: the flag alone decides", () => {
    const open = parse({ id: "a", key: "degraded_service" })!;
    expect(isNewsBannerLive(open, new Date("2030-01-01T00:00:00Z"))).toBe(true);
  });
});

describe("newsBannerFitsPage", () => {
  const at = (placement: string) =>
    parse({ id: "a", key: "degraded_service", placement })!;

  it("keeps an app banner inside /app", () => {
    expect(newsBannerFitsPage(at("app"), "/app")).toBe(true);
    expect(newsBannerFitsPage(at("app"), "/app/feed")).toBe(true);
    expect(newsBannerFitsPage(at("app"), "/")).toBe(false);
    // Not fooled by a public path that merely starts with the letters.
    expect(newsBannerFitsPage(at("app"), "/apply")).toBe(false);
  });

  it("keeps a public banner outside /app", () => {
    expect(newsBannerFitsPage(at("public"), "/")).toBe(true);
    expect(newsBannerFitsPage(at("public"), "/legal/privacy")).toBe(true);
    expect(newsBannerFitsPage(at("public"), "/app/feed")).toBe(false);
  });

  it("shows an 'all' banner everywhere", () => {
    expect(newsBannerFitsPage(at("all"), "/")).toBe(true);
    expect(newsBannerFitsPage(at("all"), "/app")).toBe(true);
  });
});
