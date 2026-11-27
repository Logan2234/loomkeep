import { describe, expect, it } from "vitest";
import { deviceLabel } from "./device-label";

const CHROME_WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";
const SAFARI_IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Mobile/15E148 Safari/604.1";
const EDGE_WINDOWS = `${CHROME_WINDOWS} Edg/140.0.0.0`;
const FIREFOX_LINUX =
  "Mozilla/5.0 (X11; Linux x86_64; rv:135.0) Gecko/20100101 Firefox/135.0";

describe("deviceLabel", () => {
  it("names the browser and the OS", () => {
    expect(deviceLabel(CHROME_WINDOWS)).toBe("Chrome · Windows");
    expect(deviceLabel(SAFARI_IPHONE)).toBe("Safari · iPhone");
    expect(deviceLabel(FIREFOX_LINUX)).toBe("Firefox · Linux");
  });

  it("does not mistake Edge for Chrome, or Chrome for Safari", () => {
    // Every Chromium UA carries "Safari", and Edge's carries "Chrome" too —
    // the detection order is what keeps these apart, so it stays pinned here.
    expect(deviceLabel(EDGE_WINDOWS)).toBe("Edge · Windows");
    expect(deviceLabel(CHROME_WINDOWS)).not.toContain("Safari");
  });

  it("stays stable across a browser version bump", () => {
    // AuthService.deviceKeyFor uses this label as the device identity: a
    // version bump must not read as a new device and fire a login alert.
    expect(deviceLabel(CHROME_WINDOWS)).toBe(
      deviceLabel(CHROME_WINDOWS.replace("140.0.0.0", "141.0.0.0")),
    );
  });

  it("returns null when there is nothing to go on", () => {
    expect(deviceLabel(null)).toBeNull();
    expect(deviceLabel(undefined)).toBeNull();
    expect(deviceLabel("")).toBeNull();
    expect(deviceLabel("curl/8.9.1")).toBeNull();
  });

  it("keeps the half it recognises when the other is unknown", () => {
    expect(deviceLabel("Mozilla/5.0 (Windows NT 10.0)")).toBe("Windows");
    expect(deviceLabel("Firefox/135.0")).toBe("Firefox");
  });
});
