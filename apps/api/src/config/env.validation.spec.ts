import { describe, expect, it } from "vitest";
import { validateEnv } from "./env.validation";

function baseEnv(
  overrides: Record<string, string | undefined> = {},
): Record<string, string | undefined> {
  return {
    DATABASE_URL: "postgresql://localhost/loomkeep",
    JWT_ACCESS_SECRET: "access-secret",
    JWT_REFRESH_SECRET: "refresh-secret",
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

  it("passes in production once MFA_ENCRYPTION_KEY is set", () => {
    const env = baseEnv({
      NODE_ENV: "production",
      MFA_ENCRYPTION_KEY: "base64key",
    });

    expect(() => validateEnv(env)).not.toThrow();
  });
});
