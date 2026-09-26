import { afterEach, describe, expect, it, vi } from "vitest";
import { auth } from "./auth.svelte";
import {
  formatBytes,
  formatDurationMs,
  formatRelative,
  formatRuntimeTimecode,
  joinMeta,
} from "./format";
import { getLocale, overwriteGetLocale } from "./paraglide/runtime.js";

vi.mock("./auth.svelte", () => ({ auth: { user: { locale: "en" } } }));
const originalGetLocale = getLocale;
const originalUser = auth.user;
afterEach(() => {
  auth.user = originalUser;
  overwriteGetLocale(originalGetLocale);
  vi.useRealTimers();
});

describe("joinMeta", () => {
  it("joins the known parts with a middle dot and skips the missing ones", () => {
    expect(joinMeta("Film", 2024)).toBe("Film · 2024");
    expect(joinMeta("", null, 2024, undefined)).toBe("2024");
    expect(joinMeta(null)).toBe("");
  });
});

describe("formatRuntimeTimecode", () => {
  it("reads as mm:00 under an hour and h:mm:00 from an hour up", () => {
    expect(formatRuntimeTimecode(48)).toBe("48:00");
    expect(formatRuntimeTimecode(7)).toBe("07:00");
    expect(formatRuntimeTimecode(60)).toBe("1:00:00");
    expect(formatRuntimeTimecode(166)).toBe("2:46:00");
  });
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
