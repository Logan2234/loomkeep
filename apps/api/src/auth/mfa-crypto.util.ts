import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

/**
 * Encrypts a TOTP secret with AES-256-GCM so the server can decrypt it back
 * at verification time (unlike bcrypt/SHA-256, which are one-way and unsuited
 * to a value the app must read back). Output is `iv:authTag:ciphertext`,
 * each base64 — a fresh random IV every call, so ciphertext differs across
 * calls even for the same plaintext.
 */
export function encryptTotpSecret(plain: string, key: Buffer): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plain, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [
    iv.toString("base64"),
    authTag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

export function decryptTotpSecret(encrypted: string, key: Buffer): string {
  const [ivB64, authTagB64, ciphertextB64] = encrypted.split(":");

  if (!ivB64 || !authTagB64 || !ciphertextB64) {
    throw new Error("Malformed encrypted TOTP secret");
  }

  const decipher = createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(ivB64, "base64"),
  );
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}
