import { ErrorCode } from "@loomkeep/shared";
import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
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
  mfa: { mfaTotpEnabled?: boolean; mfaEmailEnabled?: boolean } = {},
  nodeEnv: string = "production",
) {
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue({
        role,
        mfaTotpEnabled: false,
        mfaEmailEnabled: false,
        ...mfa,
      }),
    },
  } as unknown as PrismaService;
  const config = {
    get: jest.fn((key: string) => (key === "NODE_ENV" ? nodeEnv : undefined)),
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

  it("rejects an admin account with no MFA method active in production (LK-C17)", async () => {
    const { guard } = makeGuard("ADMIN", {}, "production");
    await expect(guard.canActivate(contextFor("user-1"))).rejects.toThrow(
      AppException,
    );
    await expect(guard.canActivate(contextFor("user-1"))).rejects.toMatchObject(
      { code: ErrorCode.AuthMfaRequired },
    );
  });

  it("allows an admin account with no MFA method active outside production", async () => {
    const { guard } = makeGuard("ADMIN", {}, "development");
    await expect(guard.canActivate(contextFor("user-1"))).resolves.toBe(true);
  });

  it("rejects an account with the USER role", async () => {
    const { guard } = makeGuard("USER");
    await expect(guard.canActivate(contextFor("user-1"))).rejects.toThrow(
      ForbiddenException,
    );
  });

  it("rejects when the request carries no authenticated user", async () => {
    const { guard, prisma } = makeGuard("ADMIN", { mfaTotpEnabled: true });
    await expect(guard.canActivate(contextFor())).rejects.toThrow(
      ForbiddenException,
    );
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
});
