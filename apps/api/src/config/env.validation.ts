/**
 * Fail-fast check for `ConfigModule.forRoot({ validate })` — everything else
 * (catalog provider keys, backups, SMTP, push...) stays lazily read and
 * feature-gated where it's used, matching the "absent key disables the
 * feature" convention used across the app (e.g. `GET /import/availability`).
 * These are the exceptions: values whose absence breaks the app outright
 * rather than a single feature.
 */
const ALWAYS_REQUIRED = [
  "DATABASE_URL",
  "JWT_ACCESS_SECRET",
  "JWT_REFRESH_SECRET",
] as const;

export function validateEnv(
  env: Record<string, string | undefined>,
): Record<string, string | undefined> {
  const missing: string[] = ALWAYS_REQUIRED.filter((key) => !env[key]);

  // AdminGuard enforces MFA on every admin account unconditionally once
  // NODE_ENV=production (LK-C17) — without this key, TOTP setup throws and
  // email MFA depends on SMTP being configured too, so a production admin
  // with neither can end up permanently locked out of /admin.
  if (env.NODE_ENV === "production" && !env.MFA_ENCRYPTION_KEY) {
    missing.push("MFA_ENCRYPTION_KEY");
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(", ")} — see .env.example (root or apps/api).`,
    );
  }

  return env;
}
