/**
 * Canonical form of an email address: trimmed and lowercased.
 *
 * `User.email` is a plain unique column, so Postgres compares it byte for
 * byte. Without normalising on the way in, `Alice@x.com` and `alice@x.com`
 * are two separate accounts, signing in with the wrong case fails, and
 * "forgot password" silently no-ops on an address that visibly exists.
 *
 * Only case is touched. Provider-specific tricks (stripping Gmail dots or
 * `+tags`) are deliberately left alone: they change which mailbox an address
 * means, which is the user's business, not ours.
 */
export function normalizeEmail(value: unknown): unknown {
  return typeof value === "string" ? value.trim().toLowerCase() : value;
}
