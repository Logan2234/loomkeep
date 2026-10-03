import { ErrorCode } from "@loomkeep/shared";
import { describe, expect, it } from "vitest";
import { AppException } from "../common/app.exception";
import { assertNotSuspended, isSuspended } from "./suspension.util";

const NOW = new Date("2026-10-03T12:00:00Z");

describe("isSuspended", () => {
  it("holds only while the end date is in the future", () => {
    expect(isSuspended({ suspendedUntil: null }, NOW)).toBe(false);
    expect(
      isSuspended({ suspendedUntil: new Date("2026-10-10T00:00:00Z") }, NOW),
    ).toBe(true);
    expect(
      isSuspended({ suspendedUntil: new Date("2026-10-01T00:00:00Z") }, NOW),
    ).toBe(false);
  });
});

describe("assertNotSuspended", () => {
  it("refuses a suspended account with its end date", () => {
    const until = new Date(Date.now() + 86_400_000);

    try {
      assertNotSuspended({ suspendedUntil: until });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(AppException);
      expect((err as AppException).code).toBe(ErrorCode.AuthAccountSuspended);
      expect((err as AppException).params).toEqual({
        until: until.toISOString(),
      });
    }
  });

  it("lets an account through once the suspension has passed", () => {
    expect(() =>
      assertNotSuspended({ suspendedUntil: new Date(Date.now() - 1000) }),
    ).not.toThrow();
  });
});
