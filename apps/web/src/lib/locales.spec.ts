import { describe, expect, it } from "vitest";
import { languageName, languageOptions } from "./locales";

describe("languageName", () => {
  it("names each language in itself", () => {
    expect(languageName("fr")).toBe("Français");
    expect(languageName("en")).toBe("English");
    expect(languageName("es")).toBe("Español");
  });
});

describe("languageOptions", () => {
  it("lists every shipped locale by its own name", () => {
    expect(languageOptions()).toEqual([
      { value: "fr", label: "Français" },
      { value: "en", label: "English" },
      { value: "it", label: "Italiano" },
    ]);
  });
});
