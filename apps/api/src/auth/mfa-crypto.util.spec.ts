import { randomBytes } from "node:crypto";
import { decryptTotpSecret, encryptTotpSecret } from "./mfa-crypto.util";

const KEY = randomBytes(32);

describe("mfa-crypto.util", () => {
  it("round-trips a plaintext secret through encrypt/decrypt", () => {
    const plain = "JBSWY3DPEHPK3PXP";
    const encrypted = encryptTotpSecret(plain, KEY);
    expect(decryptTotpSecret(encrypted, KEY)).toBe(plain);
  });

  it("produces a different ciphertext each call for the same plaintext (random IV)", () => {
    const plain = "JBSWY3DPEHPK3PXP";
    expect(encryptTotpSecret(plain, KEY)).not.toBe(
      encryptTotpSecret(plain, KEY),
    );
  });

  it("fails to decrypt with the wrong key", () => {
    const encrypted = encryptTotpSecret("JBSWY3DPEHPK3PXP", KEY);
    const wrongKey = randomBytes(32);
    expect(() => decryptTotpSecret(encrypted, wrongKey)).toThrow();
  });
});
