import { ExecutionContext, ForbiddenException } from "@nestjs/common";
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
  return { guard: new AdminGuard(prisma), prisma };
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

  it("rejects an admin account with no MFA method active (LK-C17)", async () => {
    const { guard } = makeGuard("ADMIN");
    await expect(guard.canActivate(contextFor("user-1"))).rejects.toThrow(
      "MFA_REQUIRED",
    );
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
