import { createHash, randomBytes, randomInt } from "node:crypto";

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function randomToken(
  bytes: number,
  encoding: "hex" | "base64url",
): string {
  return randomBytes(bytes).toString(encoding);
}

export function randomNumericCode(length: number): string {
  return randomInt(0, 10 ** length)
    .toString()
    .padStart(length, "0");
}
