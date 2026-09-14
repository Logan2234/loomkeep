import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Per-process key for the comparison below. Random and never persisted: it
 * exists only so two digests computed in the same process can be compared,
 * never to store or transmit anything.
 */
const COMPARISON_KEY = randomBytes(32);

/**
 * Constant-time comparison of two secrets of any length (double-HMAC).
 *
 * `timingSafeEqual` throws on buffers of different sizes, so callers used to
 * guard it with a length check — which answers "how long is the real secret?"
 * in the time it takes to reject. Running both sides through an HMAC first
 * makes every comparison run over 32 bytes whatever the inputs were, so length
 * stops being observable and the guard disappears with it.
 *
 * HMAC under a random per-process key rather than a bare digest: the output is
 * then meaningless outside this process, so a digest that leaked through a log
 * or a crash dump can't be matched against a precomputed table or correlated
 * with the same secret seen elsewhere.
 *
 * Not a password primitive. These are high-entropy machine secrets (API keys,
 * HMAC signatures) compared in memory — a stored user password needs bcrypt
 * (see `BCRYPT_ROUNDS` in auth.service.ts), which is a different problem.
 *
 * CodeQL's `js/insufficient-password-hash` flags this: it sees a value read
 * from config reaching a non-KDF hash and infers a password. The alert is
 * dismissed as a false positive, and following its advice would make things
 * worse — a deliberately slow KDF on every API request is a denial-of-service
 * vector, and it protects nothing here since no digest is ever stored or sent.
 * The only two callers are `PublicStatsGuard` (a machine API key) and
 * `QuackbackWebhookGuard` (an already-computed HMAC digest); keep it that way.
 */
export function secretsMatch(expected: string, provided: string): boolean {
  return timingSafeEqual(fingerprint(expected), fingerprint(provided));
}

function fingerprint(value: string): Buffer {
  return createHmac("sha256", COMPARISON_KEY).update(value, "utf8").digest();
}
