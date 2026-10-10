import { randomInt } from "node:crypto";
import { vi } from "vitest";
import { randomNumericCode, randomToken, sha256Hex } from "./crypto.util";

vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:crypto")>();
  return { ...actual, randomInt: vi.fn(() => 7) };
});

describe("crypto utilities", () => {
  it("retains leading zeroes in numeric OTPs", () => {
    expect(randomNumericCode(6)).toBe("000007");
    expect(randomInt).toHaveBeenLastCalledWith(0, 1_000_000);
  });
  it("retains the SHA-256 hex format used by existing tokens", () => {
    expect(sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it.each([
    [32, "hex"],
    [24, "base64url"],
  ] as const)(
    "keeps %i bytes of randomness in %s tokens",
    (bytes, encoding) => {
      const token = randomToken(bytes, encoding);
      expect(Buffer.from(token, encoding)).toHaveLength(bytes);
      expect(Buffer.from(token, encoding).toString(encoding)).toBe(token);
      expect(randomToken(bytes, encoding)).not.toBe(token);
    },
  );
});
