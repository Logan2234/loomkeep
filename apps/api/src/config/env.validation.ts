import { isHardened } from "../common/hardening.util";

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

  // AdminGuard enforces MFA on every admin account on a hardened instance
  // (see isHardened) — without this key, TOTP setup throws and
  // email MFA depends on SMTP being configured too, so a production admin
  // with neither can end up permanently locked out of /admin.
  if (isHardened((key) => env[key]) && !env.MFA_ENCRYPTION_KEY) {
    missing.push("MFA_ENCRYPTION_KEY");
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(", ")} — see .env.example (root or apps/api).`,
    );
  }

  if (isHardened((key) => env[key])) assertStrongJwtSecrets(env);

  return env;
}

// What `openssl rand -hex 32` gives is 64; 32 rules out a word or an example
// value, which could be tested offline against one captured cookie.
const JWT_SECRET_MIN_LENGTH = 32;

/**
 * The two secrets sign the JWTs and, together, derive the key encrypting
 * the session cookies: a guessable pair gives away both. Checked on an
 * exposed deployment only, where MFA_ENCRYPTION_KEY is required too.
 */
function assertStrongJwtSecrets(env: Record<string, string | undefined>): void {
  const short = (["JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"] as const).filter(
    (key) => (env[key] ?? "").length < JWT_SECRET_MIN_LENGTH,
  );

  if (short.length > 0) {
    throw new Error(
      `${short.join(", ")} must be at least ${JWT_SECRET_MIN_LENGTH} characters: generate each with \`openssl rand -hex 32\`.`,
    );
  }

  if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
    throw new Error(
      "JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different: generate each with `openssl rand -hex 32`.",
    );
  }
}
