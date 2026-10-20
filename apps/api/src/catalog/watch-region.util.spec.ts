import { resolveWatchRegion } from "./watch-region.util";

describe("resolveWatchRegion", () => {
  it("keeps the country the user picked", () => {
    expect(resolveWatchRegion("BE", "fr-FR,fr;q=0.9")).toBe("BE");
  });

  it("takes the country of the browser's preferred language otherwise", () => {
    expect(resolveWatchRegion(undefined, "fr-CA,fr;q=0.9,en;q=0.8")).toBe("CA");
    expect(resolveWatchRegion(undefined, "en-gb")).toBe("GB");
  });

  it("falls back to the United States when the preferred language names no country", () => {
    expect(resolveWatchRegion(undefined, "en,en-US;q=0.9")).toBe("US");
    expect(resolveWatchRegion(undefined, undefined)).toBe("US");
    expect(resolveWatchRegion(undefined, "zh-Hant-TW")).toBe("US");
  });

  it("ignores a malformed pick", () => {
    expect(resolveWatchRegion("france", "de-DE")).toBe("DE");
  });
});
