import { randomToken, sha256Hex } from "./crypto.util";

describe("crypto utilities", () => {
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
