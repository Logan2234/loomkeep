import { describe, expect, it } from "vitest";
import { isHardened } from "./hardening.util";

const env = (values: Record<string, string>) => (key: string) => values[key];

// The base compose leaves NODE_ENV unset: an HTTPS instance behind its own
// proxy used to run with insecure cookies and no admin MFA (audit
// 2026-11-14, SEC-02).
describe("isHardened", () => {
  it("hardens production, and any instance served over https", () => {
    expect(isHardened(env({ NODE_ENV: "production" }))).toBe(true);
    expect(isHardened(env({ WEB_ORIGIN: "https://media.example.org" }))).toBe(
      true,
    );
    expect(
      isHardened(
        env({ WEB_ORIGIN: "https://media.example.org/,http://192.168.1.2" }),
      ),
    ).toBe(true);
  });

  it("leaves a plain-http instance, development and tests alone", () => {
    expect(isHardened(env({ WEB_ORIGIN: "http://192.168.1.20:8080" }))).toBe(
      false,
    );
    expect(isHardened(env({}))).toBe(false);
    expect(
      isHardened(
        env({ NODE_ENV: "development", WEB_ORIGIN: "https://dev.example.org" }),
      ),
    ).toBe(false);
    expect(
      isHardened(
        env({ NODE_ENV: "test", WEB_ORIGIN: "https://x.example.org" }),
      ),
    ).toBe(false);
  });
});
