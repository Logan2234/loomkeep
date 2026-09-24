import { describe, expect, it, vi } from "vitest";
import {
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
    ["no id", { key: "degraded_service" }],
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
