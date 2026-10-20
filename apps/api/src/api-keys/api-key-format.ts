import { API_KEY_PREFIX } from "@loomkeep/shared";
import { randomBytes } from "node:crypto";
import { crc32 } from "node:zlib";

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

// 43 base62 characters hold the 256 random bits; 6 hold a CRC32.
const RANDOM_LENGTH = 43;
const CHECKSUM_LENGTH = 6;

const SHAPE = new RegExp(
  `^${API_KEY_PREFIX}[0-9A-Za-z]{${RANDOM_LENGTH + CHECKSUM_LENGTH}}$`,
);

/**
 * `lk_` + 256 random bits + a CRC32 of the rest, all in base62 — the format
 * GitHub's secret scanning recommends: the prefix makes a key easy to spot,
 * base62 keeps it one word (no `-` or `_` to break a double-click), and the
 * checksum lets a scanner, or our own guard, discard a lookalike without a
 * database lookup.
 */
export function generateApiKeySecret(): string {
  const random = toBase62(
    BigInt(`0x${randomBytes(32).toString("hex")}`),
    RANDOM_LENGTH,
  );
  return `${API_KEY_PREFIX}${random}${checksumOf(API_KEY_PREFIX + random)}`;
}

export function isWellFormedApiKey(secret: string): boolean {
  if (!SHAPE.test(secret)) return false;
  const body = secret.slice(0, -CHECKSUM_LENGTH);
  return secret.slice(-CHECKSUM_LENGTH) === checksumOf(body);
}

function checksumOf(body: string): string {
  return toBase62(BigInt(crc32(body)), CHECKSUM_LENGTH);
}

function toBase62(value: bigint, length: number): string {
  let out = "";
  let rest = value;

  while (rest > 0n) {
    out = BASE62[Number(rest % 62n)] + out;
    rest /= 62n;
  }

  return out.padStart(length, "0");
}
