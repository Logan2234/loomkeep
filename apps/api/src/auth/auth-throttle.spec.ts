import {
  AUTH_THROTTLE_LIMIT,
  AUTH_THROTTLE_TTL_MS,
  readLimit,
} from "./auth-throttle";

/**
 * The limit is overridable so the e2e suite can raise it, which means a
 * deployment could too. These tests are the guard on the guard: the default
 * has to stay the production value, and a bad override must not be able to
 * widen the window by accident.
 */
describe("auth throttle budget", () => {
  it("defaults to the production limit", () => {
    // The e2e suite sets AUTH_THROTTLE_LIMIT; unit tests do not, so the value
    // read at import time here is the shipped one.
    expect(AUTH_THROTTLE_LIMIT).toBe(10);
    expect(AUTH_THROTTLE_TTL_MS).toBe(60_000);
  });

  it("takes a positive integer override", () => {
    expect(readLimit("1000", 10)).toBe(1000);
    expect(readLimit("1", 10)).toBe(1);
    // Exponent notation parses to a whole number, so it is accepted as one.
    expect(readLimit("1e3", 10)).toBe(1000);
  });

  it("falls back to the production limit rather than trusting a bad value", () => {
    // A typo in an env file must not turn into "no limit at all".
    for (const bad of ["0", "-5", "abc", "", "10.5", "Infinity"]) {
      expect(readLimit(bad, 10)).toBe(10);
    }

    expect(readLimit(undefined, 10)).toBe(10);
  });
});
