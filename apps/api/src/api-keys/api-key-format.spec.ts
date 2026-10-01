import { describe, expect, it } from "vitest";
import { generateApiKeySecret, isWellFormedApiKey } from "./api-key-format";

describe("API key format", () => {
  it("generates lk_ keys of 52 base62 characters that check out", () => {
    const secret = generateApiKeySecret();

    expect(secret).toMatch(/^lk_[0-9A-Za-z]{49}$/);
    expect(isWellFormedApiKey(secret)).toBe(true);
  });

  it("never generates the same key twice", () => {
    expect(generateApiKeySecret()).not.toBe(generateApiKeySecret());
  });

  it("rejects a key whose checksum doesn't match", () => {
    const secret = generateApiKeySecret();
    const last = secret.at(-1) === "0" ? "1" : "0";

    expect(isWellFormedApiKey(secret.slice(0, -1) + last)).toBe(false);
  });

  it("rejects anything that isn't shaped like a key", () => {
    expect(isWellFormedApiKey("lk_short")).toBe(false);
    expect(isWellFormedApiKey(`lk_${"-".repeat(49)}`)).toBe(false);
    expect(isWellFormedApiKey(`xx_${"0".repeat(49)}`)).toBe(false);
  });
});
