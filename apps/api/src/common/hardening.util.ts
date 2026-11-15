import { primaryWebOrigin } from "./web-origin.util";

/**
 * Whether the API runs as an exposed deployment and applies its hardening:
 * Secure session cookies, a second factor required on admin accounts, and
 * MFA_ENCRYPTION_KEY required at startup.
 *
 * NODE_ENV=production says so (docker-compose.prod.yml), and so does an
 * https WEB_ORIGIN: the base compose leaves NODE_ENV unset, and an instance
 * served over HTTPS behind its own reverse proxy used to run with none of
 * the above. Local development and the test suites opt out through
 * NODE_ENV; a plain-http WEB_ORIGIN (a NAS on the LAN) stays unhardened, as
 * a Secure cookie never travels over http.
 */
export function isHardened(read: (key: string) => string | undefined): boolean {
  const nodeEnv = read("NODE_ENV");
  if (nodeEnv === "production") return true;
  if (nodeEnv === "development" || nodeEnv === "test") return false;
  return primaryWebOrigin(read("WEB_ORIGIN")).startsWith("https://");
}
