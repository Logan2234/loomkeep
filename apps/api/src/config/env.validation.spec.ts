import { validateEnv } from "./env.validation";

function baseEnv(
  overrides: Record<string, string | undefined> = {},
): Record<string, string | undefined> {
  return {
    DATABASE_URL: "postgresql://localhost/loomkeep",
    JWT_ACCESS_SECRET: "access-secret-of-at-least-32-characters",
    JWT_REFRESH_SECRET: "refresh-secret-of-at-least-32-characters",
    ...overrides,
  };
}

describe("validateEnv", () => {
  it("passes through a valid dev env unchanged", () => {
    const env = baseEnv({ NODE_ENV: "development" });

    expect(validateEnv(env)).toBe(env);
  });

  it.each(["DATABASE_URL", "JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"])(
    "throws when %s is missing",
    (key) => {
      const env = baseEnv({ [key]: undefined });

      expect(() => validateEnv(env)).toThrow(key);
    },
  );

  it("does not require MFA_ENCRYPTION_KEY outside production", () => {
    const env = baseEnv({ NODE_ENV: "development" });

    expect(() => validateEnv(env)).not.toThrow();
  });

  it("requires MFA_ENCRYPTION_KEY in production", () => {
    const env = baseEnv({ NODE_ENV: "production" });

    expect(() => validateEnv(env)).toThrow("MFA_ENCRYPTION_KEY");
  });

  // The base compose leaves NODE_ENV unset: an instance served over https
  // is a real deployment all the same (audit 2026-11-14, SEC-02).
  it("requires MFA_ENCRYPTION_KEY on an https instance without NODE_ENV", () => {
    expect(() =>
      validateEnv(baseEnv({ WEB_ORIGIN: "https://media.example.org" })),
    ).toThrow("MFA_ENCRYPTION_KEY");
    expect(() =>
      validateEnv(baseEnv({ WEB_ORIGIN: "http://192.168.1.20:8080" })),
    ).not.toThrow();
  });

  it("passes in production once MFA_ENCRYPTION_KEY is set", () => {
    const env = baseEnv({
      NODE_ENV: "production",
      MFA_ENCRYPTION_KEY: "base64key",
    });

    expect(() => validateEnv(env)).not.toThrow();
  });
});

// Two guessable secrets can be tested offline against one captured cookie:
// they sign the JWTs and derive the cookie key together (audit 2026-11-17,
// SEC-22). Enforced where the hardening is, like MFA_ENCRYPTION_KEY.
describe("validateEnv JWT secret strength", () => {
  const hardened = (overrides: Record<string, string | undefined>) =>
    baseEnv({
      NODE_ENV: "production",
      MFA_ENCRYPTION_KEY: "key",
      JWT_ACCESS_SECRET: "a".repeat(32),
      JWT_REFRESH_SECRET: "b".repeat(32),
      ...overrides,
    });

  it("accepts two distinct secrets of 32 characters or more", () => {
    expect(() => validateEnv(hardened({}))).not.toThrow();
  });

  it.each(["JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"])(
    "refuses a %s under 32 characters",
    (key) => {
      expect(() => validateEnv(hardened({ [key]: "changeme" }))).toThrow(key);
    },
  );

  it("refuses the same value for both secrets", () => {
    const same = "c".repeat(40);
    expect(() =>
      validateEnv(
        hardened({ JWT_ACCESS_SECRET: same, JWT_REFRESH_SECRET: same }),
      ),
    ).toThrow("different");
  });

  it("leaves local development alone", () => {
    expect(() =>
      validateEnv(baseEnv({ NODE_ENV: "development" })),
    ).not.toThrow();
  });
});
