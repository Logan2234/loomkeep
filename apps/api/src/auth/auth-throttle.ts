/**
 * Rate limit for the credential-handling auth routes (register, login, MFA
 * verification), on top of the app-wide 60 req/min default.
 *
 * Overridable through `AUTH_THROTTLE_LIMIT` for one reason only: the e2e suite
 * drives real registrations and logins against the real guard, and several
 * spec files doing so inside the same minute share this budget. Raising it
 * there beats calibrating the production limit around the tests — which is
 * what used to happen, and what kept the whole suite in one file.
 *
 * Nothing else should set it. A deployment that raises it is weakening its own
 * brute-force protection, so the parsing refuses anything but a positive
 * integer and falls back to the production value.
 */
const PRODUCTION_LIMIT = 10;

export const AUTH_THROTTLE_TTL_MS = 60_000;

export const AUTH_THROTTLE_LIMIT = readLimit(
  process.env.AUTH_THROTTLE_LIMIT,
  PRODUCTION_LIMIT,
);

export function readLimit(raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
