import { describe, expect, it } from "vitest";
import { regionalLocale } from "./locale";

describe("regionalLocale", () => {
  it("gives a shipped locale its region", () => {
    expect(regionalLocale("fr")).toBe("fr-FR");
    expect(regionalLocale("en")).toBe("en-US");
  });

  it("falls back to American English for no locale or an unknown one", () => {
    expect(regionalLocale(undefined)).toBe("en-US");
    expect(regionalLocale("xx")).toBe("en-US");
  });
});
