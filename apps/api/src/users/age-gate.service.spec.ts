import { ErrorCode } from "@loomkeep/shared";
import { vi } from "vitest";
import { AppException } from "../common/app.exception";
import type { PrismaService } from "../prisma/prisma.service";
import { AgeGateService } from "./age-gate.service";

function yearsAgo(years: number): Date {
  const date = new Date();
  date.setFullYear(date.getFullYear() - years);
  return date;
}

function make(
  user: { birthDate: Date | null; allowAdultContent: boolean } | null,
) {
  const prisma = {
    user: { findUnique: vi.fn().mockResolvedValue(user) },
  } as unknown as PrismaService;

  return new AgeGateService(prisma);
}

describe("AgeGateService.allowsAdultContent", () => {
  it("requires both the opt-in and actually being 18", async () => {
    const service = make({ birthDate: yearsAgo(30), allowAdultContent: true });

    expect(await service.allowsAdultContent("user-1")).toBe(true);
  });

  it("refuses a minor who opted in", async () => {
    // The opt-in is a preference, not a claim of age — the birth date decides.
    const service = make({ birthDate: yearsAgo(15), allowAdultContent: true });

    expect(await service.allowsAdultContent("user-1")).toBe(false);
  });

  it("refuses an adult who never opted in", async () => {
    const service = make({ birthDate: yearsAgo(30), allowAdultContent: false });

    expect(await service.allowsAdultContent("user-1")).toBe(false);
  });

  it("refuses an account with no birth date on file", async () => {
    // Unknown age is never adult — the gate fails closed.
    const service = make({ birthDate: null, allowAdultContent: true });

    expect(await service.allowsAdultContent("user-1")).toBe(false);
  });

  it("refuses a user that no longer exists", async () => {
    const service = make(null);

    expect(await service.allowsAdultContent("ghost")).toBe(false);
  });
});

describe("AgeGateService.assertAdultAllowed", () => {
  it("throws a typed forbidden error on a restricted title", () => {
    const service = make(null);

    try {
      service.assertAdultAllowed(true, false);
      throw new Error("expected assertAdultAllowed to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(AppException);
      expect((err as AppException).code).toBe(
        ErrorCode.UserAdultContentDisabled,
      );
    }
  });

  it("lets everything else through", () => {
    const service = make(null);

    expect(() => service.assertAdultAllowed(true, true)).not.toThrow();
    expect(() => service.assertAdultAllowed(false, false)).not.toThrow();
  });
});
