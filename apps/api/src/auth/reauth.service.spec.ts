import { ErrorCode } from "@loomkeep/shared";
import * as bcrypt from "bcryptjs";
import { type Mock, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import type { SecurityEventService } from "../security/security-event.service";
import type { AuthService } from "./auth.service";
import type { MfaService } from "./mfa.service";
import { MAX_REAUTH_FAILURES, ReauthService } from "./reauth.service";
import type { WebauthnService } from "./webauthn.service";

const PASSWORD = "popcorn";

function setup({ failures = 0, totp = false, keys = false } = {}) {
  const prisma = {
    user: {
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        passwordHash: bcrypt.hashSync(PASSWORD, 4),
        mfaTotpEnabled: totp,
        mfaTotpSecretEnc: totp ? "enc" : null,
      }),
    },
    refreshToken: {
      findUnique: vi.fn().mockResolvedValue({ reauthenticatedAt: null }),
      update: vi.fn(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(
          "reauthFailures" in data && typeof data.reauthFailures === "object"
            ? { reauthFailures: failures + 1 }
            : { reauthenticatedAt: data.reauthenticatedAt },
        ),
      ),
    },
  } as unknown as PrismaService;
  const auth = { revokeSession: vi.fn() } as unknown as AuthService;
  const mfa = { acceptTotpCode: vi.fn() } as unknown as MfaService;
  const webauthn = {
    hasCredentials: vi.fn().mockResolvedValue(keys),
    verifyReauth: vi.fn(),
  } as unknown as WebauthnService;
  const security = { record: vi.fn() } as unknown as SecurityEventService;

  return {
    service: new ReauthService(prisma, auth, mfa, webauthn, security),
    prisma,
    auth,
    mfa,
    security,
  };
}

describe("ReauthService", () => {
  it("offers the account's methods, strongest first", async () => {
    await expect(
      setup({ totp: true, keys: true }).service.status("u1", "s1"),
    ).resolves.toEqual({
      methods: ["webauthn", "totp", "password"],
      confirmedUntil: null,
    });
    await expect(setup().service.status("u1", "s1")).resolves.toMatchObject({
      methods: ["password"],
    });
  });

  it("confirms the session for ten minutes with the right password", async () => {
    const { service, prisma } = setup({ failures: 2 });

    const { confirmedUntil } = await service.confirm("u1", "s1", {
      method: "password",
      password: PASSWORD,
    });

    expect(prisma.refreshToken.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "s1" },
        data: { reauthenticatedAt: expect.any(Date), reauthFailures: 0 },
      }),
    );
    expect(new Date(confirmedUntil).getTime() - Date.now()).toBeGreaterThan(
      9 * 60_000,
    );
  });

  // A 401 would make the web client refresh its token and send it again.
  it("answers a wrong proof with a 400 and counts it", async () => {
    const { service, prisma } = setup();

    await expect(
      service.confirm("u1", "s1", { method: "password", password: "nope" }),
    ).rejects.toMatchObject({
      code: ErrorCode.AuthCurrentPasswordIncorrect,
      status: 400,
    });
    expect(prisma.refreshToken.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { reauthFailures: { increment: 1 } } }),
    );
  });

  it("tells a code that already served from a wrong one", async () => {
    const { service, mfa } = setup({ totp: true });
    (mfa.acceptTotpCode as Mock).mockResolvedValue("reused");

    await expect(
      service.confirm("u1", "s1", { method: "totp", code: "135790" }),
    ).rejects.toMatchObject({ code: ErrorCode.AuthTotpCodeReused });
  });

  it("signs the session out at the last failed attempt", async () => {
    const { service, auth, security } = setup({
      failures: MAX_REAUTH_FAILURES - 1,
    });

    await expect(
      service.confirm("u1", "s1", { method: "password", password: "nope" }),
    ).rejects.toMatchObject({ code: ErrorCode.AuthReauthTooManyAttempts });
    expect(auth.revokeSession).toHaveBeenCalledWith("u1", "s1");
    expect(security.record).toHaveBeenCalledWith({
      type: "REAUTH_LOCKED",
      userId: "u1",
    });
  });
});
