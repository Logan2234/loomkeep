import { ErrorCode } from "@loomkeep/shared";
import type { ExecutionContext } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { vi } from "vitest";
import { AppException } from "../common/app.exception";
import type { PrismaService } from "../prisma/prisma.service";
import { AdminGuard } from "./admin.guard";

function contextFor(userId?: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user: userId ? { sub: userId } : undefined }),
    }),
  } as unknown as ExecutionContext;
}

function makeGuard(
  role: unknown,
  mfa: {
    mfaTotpEnabled?: boolean;
    mfaEmailEnabled?: boolean;
    webauthnCredentials?: number;
  } = {},
  nodeEnv = "production",
  webOrigin?: string,
) {
  const prisma = {
    user: {
      findUnique: vi.fn().mockResolvedValue({
        role,
        mfaTotpEnabled: mfa.mfaTotpEnabled ?? false,
        mfaEmailEnabled: mfa.mfaEmailEnabled ?? false,
        _count: { webauthnCredentials: mfa.webauthnCredentials ?? 0 },
      }),
    },
  } as unknown as PrismaService;
  const config = {
    get: vi.fn((key: string) =>
      key === "NODE_ENV"
        ? nodeEnv
        : key === "WEB_ORIGIN"
          ? webOrigin
          : undefined,
    ),
  } as unknown as ConfigService;
  return { guard: new AdminGuard(prisma, config), prisma };
}

describe("AdminGuard", () => {
  it("allows an admin account with TOTP MFA active", async () => {
    const { guard } = makeGuard("ADMIN", { mfaTotpEnabled: true });
    await expect(guard.canActivate(contextFor("user-1"))).resolves.toBe(true);
  });

  it("allows an admin account with email MFA active", async () => {
    const { guard } = makeGuard("ADMIN", { mfaEmailEnabled: true });
    await expect(guard.canActivate(contextFor("user-1"))).resolves.toBe(true);
  });

  it("allows an admin account protected by a security key or passkey alone", async () => {
    const { guard } = makeGuard("ADMIN", { webauthnCredentials: 1 });
    await expect(guard.canActivate(contextFor("user-1"))).resolves.toBe(true);
  });

  it("rejects an admin account with no MFA method active in production", async () => {
    const { guard } = makeGuard("ADMIN", {}, "production");
    await expect(guard.canActivate(contextFor("user-1"))).rejects.toThrow(
      AppException,
    );
    await expect(guard.canActivate(contextFor("user-1"))).rejects.toMatchObject(
      { code: ErrorCode.AuthMfaRequired },
    );
  });

  // An https instance from the base compose has no NODE_ENV: its admin
  // still needs a second factor (audit 2026-11-14, SEC-02).
  it("rejects an admin with no MFA method on an https instance without NODE_ENV", async () => {
    // "" stands for unset: undefined would take the "production" default.
    const { guard } = makeGuard("ADMIN", {}, "", "https://media.example.org");
    await expect(guard.canActivate(contextFor("user-1"))).rejects.toMatchObject(
      { code: ErrorCode.AuthMfaRequired },
    );
  });

  it("allows an admin with no MFA method on a plain-http LAN instance", async () => {
    const { guard } = makeGuard("ADMIN", {}, "", "http://192.168.1.20");
    await expect(guard.canActivate(contextFor("user-1"))).resolves.toBe(true);
  });

  it("allows an admin account with no MFA method active outside production", async () => {
    const { guard } = makeGuard("ADMIN", {}, "development");
    await expect(guard.canActivate(contextFor("user-1"))).resolves.toBe(true);
  });

  it("rejects an account with the USER role", async () => {
    const { guard } = makeGuard("USER");
    await expect(guard.canActivate(contextFor("user-1"))).rejects.toMatchObject(
      { code: ErrorCode.AdminForbidden },
    );
  });

  it("rejects when the request carries no authenticated user", async () => {
    const { guard, prisma } = makeGuard("ADMIN", { mfaTotpEnabled: true });
    await expect(guard.canActivate(contextFor())).rejects.toMatchObject({
      code: ErrorCode.AdminForbidden,
    });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
});
