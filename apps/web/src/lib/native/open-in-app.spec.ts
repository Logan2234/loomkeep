import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { canOfferApp, OPEN_IN_APP_PAGES, openInAppUrl } from "./open-in-app";

const ANDROID =
  "Mozilla/5.0 (Linux; Android 14) Chrome/130.0 Mobile Safari/537";
const DESKTOP = "Mozilla/5.0 (Windows NT 10.0) Chrome/130.0 Safari/537";

describe("canOfferApp", () => {
  const offers = (url: string, agent = ANDROID) =>
    canOfferApp(new URL(url), agent);

  it("offers the app on a self-hosted instance's app and account pages", () => {
    expect(offers("https://media.example/app")).toBe(true);
    expect(offers("https://media.example/app/settings")).toBe(true);
    expect(offers("https://media.example/reset-password?token=a")).toBe(true);
  });

  it("stays out of the public site and other devices", () => {
    expect(offers("https://media.example/")).toBe(false);
    expect(offers("https://media.example/legal/privacy-policy")).toBe(false);
    expect(offers("https://media.example/app", DESKTOP)).toBe(false);
  });

  it("leaves the hosted instance to App Links, and an http instance out", () => {
    expect(offers("https://loomkeep.app/app")).toBe(false);
    expect(offers("http://media.example/app")).toBe(false);
  });
});

describe("openInAppUrl", () => {
  it("carries the instance, the whole page and a way back to the browser", () => {
    const page = "https://media.example:8443/reset-password?token=a&b=c#top";
    const url = openInAppUrl(new URL(page));

    const link = new URL(url.split("#Intent;")[0].replace("intent:", "https:"));
    expect(link.searchParams.get("instance")).toBe(
      "https://media.example:8443",
    );
    expect(link.searchParams.get("path")).toBe(
      "/reset-password?token=a&b=c#top",
    );
    expect(url).toContain(";scheme=loomkeep;");
    expect(url).toContain(
      `S.browser_fallback_url=${encodeURIComponent(page)};end`,
    );
  });
});

describe("the native side", () => {
  const read = (file: string) =>
    readFileSync(
      new URL(
        `../../../../mobile/android/app/src/main/${file}`,
        import.meta.url,
      ),
      "utf8",
    );

  it("accepts every page offered, as App Links and as loomkeep:// links", () => {
    const manifest = read("AndroidManifest.xml");
    const link = read("java/app/loomkeep/InstanceLink.java");

    for (const page of OPEN_IN_APP_PAGES) {
      expect(manifest).toContain(`android:pathPrefix="${page}"`);
      expect(link).toContain(`"${page}"`);
    }

    expect(manifest).toContain('android:scheme="loomkeep"');
  });
});
