import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Constant-time comparison of two secrets of any length.
 *
 * `timingSafeEqual` throws on buffers of different sizes, so callers used to
 * guard it with a length check — which answers "how long is the real secret?"
 * in the time it takes to reject. Hashing both sides first makes every
 * comparison run over 32 bytes whatever the inputs were, so length stops
 * being observable and the guard disappears with it.
 */
export function secretsMatch(expected: string, provided: string): boolean {
  return timingSafeEqual(sha256(expected), sha256(provided));
}

function sha256(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}
