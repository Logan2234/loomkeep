import { describe, expect, it } from "vitest";
import { PASSWORD_MIN_LENGTH, isPasswordValid } from "./password";

const VALID = "Séance2026!";

describe("isPasswordValid", () => {
  it("accepts a password meeting all four requirements", () => {
    expect(isPasswordValid(VALID)).toBe(true);
    expect(isPasswordValid("Abcdef1!")).toBe(true);
  });

  it("rejects a password missing any single requirement", () => {
    expect(isPasswordValid("Ab1!")).toBe(false);
    expect(isPasswordValid("séance2026!")).toBe(false);
    expect(isPasswordValid("Séanceséance!")).toBe(false);
    expect(isPasswordValid("Seance2026")).toBe(false);
  });

  it("treats the minimum length as inclusive", () => {
    const atMinimum = `Ab1!${"c".repeat(PASSWORD_MIN_LENGTH - 4)}`;
    expect(atMinimum).toHaveLength(PASSWORD_MIN_LENGTH);
    expect(isPasswordValid(atMinimum)).toBe(true);
    expect(isPasswordValid(atMinimum.slice(0, -1))).toBe(false);
  });

  it("counts an accented or non-ASCII character as special, not as a letter", () => {
    // The special-character class is "anything outside [A-Za-z0-9]", so an
    // accent qualifies — worth pinning, since the web checklist renders the
    // same rule and users do type accents.
    expect(isPasswordValid("Abcdefgé1")).toBe(true);
  });

  it("rejects an empty password", () => {
    expect(isPasswordValid("")).toBe(false);
  });
});
