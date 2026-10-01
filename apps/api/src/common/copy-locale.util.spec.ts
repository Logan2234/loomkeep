import { describe, expect, it } from "vitest";
import { resolveCopyLocale } from "./copy-locale.util";

describe("resolveCopyLocale", () => {
  it("keeps a language the API writes in", () => {
    expect(resolveCopyLocale("fr")).toBe("fr");
    expect(resolveCopyLocale("en")).toBe("en");
    expect(resolveCopyLocale("it")).toBe("it");
  });

  it("falls back to the French default for a missing or unknown locale", () => {
    expect(resolveCopyLocale(undefined)).toBe("fr");
    expect(resolveCopyLocale("xx")).toBe("fr");
  });
});
