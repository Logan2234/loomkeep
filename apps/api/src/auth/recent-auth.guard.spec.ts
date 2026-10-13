import { ErrorCode, REAUTH_WINDOW_MS } from "@loomkeep/shared";
import type { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { vi } from "vitest";
import { AdminSystemController } from "../admin/admin-system.controller";
import { ApiKeysController } from "../api-keys/api-keys.controller";
import type { PrismaService } from "../prisma/prisma.service";
import { MfaController } from "../users/mfa.controller";
import { UsersController } from "../users/users.controller";
import { RECENT_AUTH_MAX_AGE, RecentAuthGuard } from "./recent-auth.guard";
import { SessionsController } from "./sessions.controller";

const MINUTE = 60_000;

function guardFor(reauthenticatedAt: Date | null) {
  const prisma = {
    refreshToken: {
      findUnique: vi.fn().mockResolvedValue({ reauthenticatedAt }),
    },
  } as unknown as PrismaService;
  return new RecentAuthGuard(new Reflector(), prisma);
}

function context(
  handler: (...args: never[]) => unknown,
  sid: string | null = "session-1",
): ExecutionContext {
  return {
    getHandler: () => handler,
    switchToHttp: () => ({
      getRequest: () => ({
        user: { sub: "u1", email: "a@b.c", sid: sid ?? undefined },
      }),
    }),
  } as unknown as ExecutionContext;
}

const ago = (ms: number) => new Date(Date.now() - ms);

describe("RecentAuthGuard", () => {
  const createKey = ApiKeysController.prototype.create;
  const deleteAccount = UsersController.prototype.deleteAccount;

  it("lets a session confirmed less than ten minutes ago through", async () => {
    await expect(
      guardFor(ago(9 * MINUTE)).canActivate(context(createKey)),
    ).resolves.toBe(true);
  });

  it.each([
    ["confirmed too long ago", ago(11 * MINUTE), "session-1"],
    ["never confirmed", null, "session-1"],
    ["no session at all", ago(MINUTE), null],
  ])("asks a session %s to confirm", async (_case, at, sid) => {
    await expect(
      guardFor(at).canActivate(context(createKey, sid)),
    ).rejects.toMatchObject({ code: ErrorCode.AuthReauthRequired });
  });

  it("wants a confirmation of the last two minutes to delete the account", async () => {
    await expect(
      guardFor(ago(3 * MINUTE)).canActivate(context(deleteAccount)),
    ).rejects.toMatchObject({ code: ErrorCode.AuthReauthRequired });
    await expect(
      guardFor(ago(MINUTE)).canActivate(context(deleteAccount)),
    ).resolves.toBe(true);
  });

  it("guards every sensitive action", () => {
    const reflector = new Reflector();
    const guarded = [
      ApiKeysController.prototype.create,
      SessionsController.prototype.revokeOthers,
      SessionsController.prototype.revokeSession,
      UsersController.prototype.changeEmail,
      UsersController.prototype.deleteAccount,
      MfaController.prototype.setupTotp,
      MfaController.prototype.disableTotp,
      MfaController.prototype.setEmailMfa,
      MfaController.prototype.regenerateRecoveryCodes,
      MfaController.prototype.registerWebauthnOptions,
      MfaController.prototype.removeWebauthnCredential,
      MfaController.prototype.setPasswordless,
      AdminSystemController.prototype.restoreBackup,
    ];

    for (const handler of guarded) {
      expect(
        reflector.get<number>(RECENT_AUTH_MAX_AGE, handler),
        handler.name,
      ).toBeLessThanOrEqual(REAUTH_WINDOW_MS);
    }
  });
});
