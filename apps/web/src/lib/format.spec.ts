import { afterEach, describe, expect, it, vi } from "vitest";
import { auth } from "./auth.svelte";
import { formatBytes, formatDurationMs, formatRelative } from "./format";
import { getLocale, overwriteGetLocale } from "./paraglide/runtime.js";

vi.mock("./auth.svelte", () => ({ auth: { user: { locale: "en" } } }));
const originalGetLocale = getLocale;
const originalUser = auth.user;
afterEach(() => {
  auth.user = originalUser;
  overwriteGetLocale(originalGetLocale);
  vi.useRealTimers();
});

describe("localized formatting", () => {
  it("formats duration decimals in the requested language", () => {
    expect(formatDurationMs(1500, "fr-FR")).toBe("1,5 s");
    expect(formatDurationMs(1500, "en-US")).toBe("1.5 s");
    expect(formatDurationMs(500, "fr-FR")).toBe("500 ms");
    expect(formatDurationMs(1000, "en-US")).toBe("1.0 s");
  });
  it("formats byte units and decimals in English", () => {
    auth.user!.locale = "en";
    overwriteGetLocale(() => "en");
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(1024 ** 2)).toBe("1.0 MB");
    expect(formatBytes(1024 ** 3)).toBe("1.0 GB");
  });

  it("preserves French byte units and decimals", () => {
    auth.user!.locale = "fr";
    overwriteGetLocale(() => "fr");
    expect(formatBytes(512)).toBe("512 o");
    expect(formatBytes(1536)).toBe("1,5 Ko");
    expect(formatBytes(1024 ** 2)).toBe("1,0 Mo");
    expect(formatBytes(1024 ** 3)).toBe("1,0 Go");
  });

  it("respects an explicit locale even for a date less than a minute ago", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-30T12:00:00Z"));
    overwriteGetLocale(() => "fr");
    expect(formatRelative("2026-08-30T11:59:50Z", "en-US")).toBe("Just now");
  });

  it("uses the active locale before the account has loaded", () => {
    auth.user = null;
    overwriteGetLocale(() => "en");
    expect(formatBytes(1536)).toBe("1.5 KB");
  });
});
