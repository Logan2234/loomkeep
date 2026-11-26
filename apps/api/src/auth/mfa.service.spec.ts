import type { ConfigService } from "@nestjs/config";
import type { EventEmitter2 } from "@nestjs/event-emitter";
import type { User } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { Secret, TOTP } from "otpauth";
import { vi, type Mock } from "vitest";
import type { EventsGateway } from "../events/events.gateway";
import type { MailService } from "../mail/mail.service";
import type { PrismaService } from "../prisma/prisma.service";
import type { SecurityEventService } from "../security/security-event.service";
import { TotpEnabledEvent } from "./auth.events";
import { encryptTotpSecret } from "./mfa-crypto.util";
import { MfaService, RECOVERY_CODE_COUNT } from "./mfa.service";
import { SessionCacheService } from "./session-cache.service";

const ENCRYPTION_KEY = randomBytes(32).toString("base64");
const CURRENT_PASSWORD = "correct";
const CURRENT_PASSWORD_HASH = bcrypt.hashSync(CURRENT_PASSWORD, 4);

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: "user-1",
    email: "alice@example.com",
    passwordHash: CURRENT_PASSWORD_HASH,
    mfaTotpEnabled: false,
    mfaTotpSecretEnc: null,
    mfaEmailEnabled: false,
    ...overrides,
  } as User;
}

function makeService() {
  let recoveryCodeRows: { id: string; userId: string; codeHash: string }[] = [];
  let nextId = 0;

  const prisma = {
    user: {
      findUniqueOrThrow: vi.fn().mockResolvedValue(makeUser()),
      update: vi.fn(),
    },
    mfaRecoveryCode: {
      count: vi.fn(() => Promise.resolve(recoveryCodeRows.length)),
      findMany: vi.fn(({ where }: { where: { userId: string } }) =>
        Promise.resolve(
          recoveryCodeRows.filter((r) => r.userId === where.userId),
        ),
      ),
      delete: vi.fn(({ where }: { where: { id: string } }) => {
        recoveryCodeRows = recoveryCodeRows.filter((r) => r.id !== where.id);
        return Promise.resolve();
      }),
      deleteMany: vi.fn(({ where }: { where: { userId: string } }) => {
        recoveryCodeRows = recoveryCodeRows.filter(
          (r) => r.userId !== where.userId,
        );
        return Promise.resolve();
      }),
      create: vi.fn(
        ({ data }: { data: { userId: string; codeHash: string } }) => {
          recoveryCodeRows.push({ id: `code-${nextId++}`, ...data });
          return Promise.resolve();
        },
      ),
    },
    refreshToken: {
      findMany: vi.fn().mockResolvedValue([{ id: "session-2" }]),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  } as unknown as PrismaService;

  const configService = {
    getOrThrow: vi.fn(() => ENCRYPTION_KEY),
  } as unknown as ConfigService;

  const mail = {} as unknown as MailService;
  const eventBus = {
    emitAsync: vi.fn().mockResolvedValue([]),
  } as unknown as EventEmitter2;
  const security = { record: vi.fn() } as unknown as SecurityEventService;
  const sessionCache = new SessionCacheService();
  const events = { disconnectSession: vi.fn() };

  return {
    service: new MfaService(
      prisma,
      configService,
      mail,
      eventBus,
      security,
      sessionCache,
      events as unknown as EventsGateway,
    ),
    sessionCache,
    events,
    prisma,
    eventBus,
    security,
  };
}

describe("MfaService recovery codes", () => {
  // bcryptjs hashes all 10 codes in parallel — pure-JS bcrypt is CPU-bound
  // enough that this can flirt with the default 5s timeout under load.
  it("generates 10 codes of 10 chars using only unambiguous characters", async () => {
    const { service, prisma } = makeService();
    const codes = await service.regenerateRecoveryCodes("user-1");

    expect(codes).toHaveLength(RECOVERY_CODE_COUNT);

    for (const code of codes) {
      expect(code).toHaveLength(10);
      expect(code).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{10}$/);
    }

    expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
    });
  }, 15_000);

  it("consumes a matching recovery code and deletes it (single-use)", async () => {
    const { service } = makeService();
    const [code] = await service.regenerateRecoveryCodes("user-1");

    await expect(service.verifyRecoveryCode("user-1", code)).resolves.toBe(
      true,
    );
    await expect(service.verifyRecoveryCode("user-1", code)).resolves.toBe(
      false,
    );
    // bcrypt.compare against up to 10 rows at BCRYPT_ROUNDS=12 is slow in pure-JS bcryptjs.
  }, 20_000);

  it("normalizes separators and case before matching", async () => {
    const { service } = makeService();
    const [code] = await service.regenerateRecoveryCodes("user-1");
    const dashed = `${code.slice(0, 5)}-${code.slice(5)}`.toLowerCase();

    await expect(service.verifyRecoveryCode("user-1", dashed)).resolves.toBe(
      true,
    );
  }, 20_000);

  it("regenerate deletes the old batch entirely rather than keeping it alongside", async () => {
    const { service, prisma } = makeService();
    const [firstCode] = await service.regenerateRecoveryCodes("user-1");
    await service.regenerateRecoveryCodes("user-1");

    expect(prisma.mfaRecoveryCode.deleteMany).toHaveBeenCalledTimes(2);
    await expect(service.verifyRecoveryCode("user-1", firstCode)).resolves.toBe(
      false,
    );
  }, 20_000);

  // verifyMfaLogin()'s `||` chain falls through to verifyRecoveryCode()
  // on every wrong TOTP/email guess — without this short-circuit, a 6-digit
  // code that plainly can't be a 10-character recovery code still cost up to
  // RECOVERY_CODE_COUNT bcrypt.compare() calls at BCRYPT_ROUNDS=12.
  it("rejects input that isn't shaped like a recovery code without touching the database", async () => {
    const { service, prisma } = makeService();

    await expect(service.verifyRecoveryCode("user-1", "123456")).resolves.toBe(
      false,
    );
    expect(prisma.mfaRecoveryCode.findMany).not.toHaveBeenCalled();
  });
});

describe("MfaService.confirmTotp / setEmailMfaEnabled — recovery code generation timing", () => {
  it("confirmTotp generates recovery codes only the first time a method is confirmed", async () => {
    const { service, prisma } = makeService();
    const secret = new Secret({ size: 20 });
    const totp = new TOTP({ secret, algorithm: "SHA1", digits: 6, period: 30 });
    const code = totp.generate();

    (prisma.user.findUniqueOrThrow as Mock).mockResolvedValue(
      makeUser({
        mfaTotpSecretEnc: encryptTotpSecret(
          secret.base32,
          Buffer.from(ENCRYPTION_KEY, "base64"),
        ),
      }),
    );

    const first = await service.confirmTotp("user-1", code, "session-1");
    expect(first.recoveryCodes).toHaveLength(RECOVERY_CODE_COUNT);
    expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1", id: { not: "session-1" } },
    });

    const second = await service.setEmailMfaEnabled(
      "user-1",
      true,
      "session-1",
    );
    expect(second.recoveryCodes).toBeUndefined();
    expect(prisma.refreshToken.deleteMany).toHaveBeenLastCalledWith({
      where: { userId: "user-1", id: { not: "session-1" } },
    });
    // Really bcrypt-hashes every recovery code (pure-JS bcryptjs): past the
    // default 5s under CI coverage instrumentation.
  }, 20_000);

  it("announces the confirmed authenticator, for the locked_down achievement", async () => {
    const { service, prisma, eventBus } = makeService();
    const secret = new Secret({ size: 20 });
    const totp = new TOTP({ secret, algorithm: "SHA1", digits: 6, period: 30 });
    const code = totp.generate();

    (prisma.user.findUniqueOrThrow as Mock).mockResolvedValue(
      makeUser({
        mfaTotpSecretEnc: encryptTotpSecret(
          secret.base32,
          Buffer.from(ENCRYPTION_KEY, "base64"),
        ),
      }),
    );

    await service.confirmTotp("user-1", code, "session-1");

    expect(eventBus.emitAsync).toHaveBeenCalledWith(
      TotpEnabledEvent.NAME,
      new TotpEnabledEvent("user-1"),
    );
    // Same bcrypt cost as the recovery code test above.
  }, 20_000);

  it("confirmTotp rejects an invalid code", async () => {
    const { service, prisma } = makeService();
    const secret = new Secret({ size: 20 });

    (prisma.user.findUniqueOrThrow as Mock).mockResolvedValue(
      makeUser({
        mfaTotpSecretEnc: encryptTotpSecret(
          secret.base32,
          Buffer.from(ENCRYPTION_KEY, "base64"),
        ),
      }),
    );

    await expect(service.confirmTotp("user-1", "000000")).rejects.toThrow();
  });
});

// Reopening the setup modal on an account with TOTP on replaced the active
// secret: the authenticator app's codes stopped working at the next login
// (audit 2026-11-17, BUG-10).
describe("MfaService.generateTotpSetup", () => {
  it("refuses while TOTP is on, leaving the active secret alone", async () => {
    const { service, prisma } = makeService();
    (prisma.user as unknown as { updateMany: Mock }).updateMany = vi
      .fn()
      .mockResolvedValue({ count: 0 });

    await expect(
      service.generateTotpSetup("user-1", "a@example.com"),
    ).rejects.toMatchObject({ code: "auth.mfa_totp_already_enabled" });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("stores a new pending secret while TOTP is off", async () => {
    const { service, prisma } = makeService();
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    (prisma.user as unknown as { updateMany: Mock }).updateMany = updateMany;

    await service.generateTotpSetup("user-1", "a@example.com");

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "user-1", mfaTotpEnabled: false },
      data: { mfaTotpSecretEnc: expect.any(String) },
    });
  });
});

describe("MfaService.disableTotp", () => {
  it("clears the stored secret, its last step and the flag", async () => {
    const { service, prisma } = makeService();

    await service.disableTotp("user-1", "session-1");

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: {
        mfaTotpEnabled: false,
        mfaTotpSecretEnc: null,
        mfaTotpLastStep: null,
      },
    });
    expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1", id: { not: "session-1" } },
    });
  });
});

// The other sessions' rows went, but their cached "still live" answer and
// their sockets stayed (audit 2026-11-17, SEC-07).
describe("MfaService — revoking the other sessions", () => {
  it("evicts them from the session cache and closes their sockets", async () => {
    const { service, sessionCache, events } = makeService();
    sessionCache.markLive("session-1");
    sessionCache.markLive("session-2");

    await service.disableTotp("user-1", "session-1");

    expect(sessionCache.isKnownLive("session-2")).toBe(false);
    expect(sessionCache.isKnownLive("session-1")).toBe(true);
    expect(events.disconnectSession).toHaveBeenCalledWith("session-2");
    expect(events.disconnectSession).not.toHaveBeenCalledWith("session-1");
  });
});

describe("MfaService.setEmailMfaEnabled — disabling", () => {
  it("clears the flag", async () => {
    const { service, prisma } = makeService();
    (prisma.user.findUniqueOrThrow as Mock).mockResolvedValue(
      makeUser({ mfaEmailEnabled: true }),
    );

    await service.setEmailMfaEnabled("user-1", false, "session-1");

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { mfaEmailEnabled: false },
    });
  });
});

describe("MfaService.acceptTotpCode", () => {
  function withSecret() {
    const setup = makeService();
    const secret = new Secret({ size: 20 });
    const totp = new TOTP({ secret, algorithm: "SHA1", digits: 6, period: 30 });
    const enc = encryptTotpSecret(
      secret.base32,
      Buffer.from(ENCRYPTION_KEY, "base64"),
    );
    return { ...setup, totp, enc };
  }

  it("accepts a live code once, then refuses it", async () => {
    const { service, prisma, totp, enc } = withSecret();
    const updateMany = vi
      .fn()
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    (prisma.user as unknown as { updateMany: Mock }).updateMany = updateMany;
    const code = totp.generate();

    await expect(service.acceptTotpCode("user-1", enc, code)).resolves.toBe(
      "accepted",
    );
    await expect(service.acceptTotpCode("user-1", enc, code)).resolves.toBe(
      "reused",
    );
    // Only a step later than the last one served moves it forward.
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: "user-1",
        OR: [
          { mfaTotpLastStep: null },
          { mfaTotpLastStep: { lt: totp.counter() } },
        ],
      },
      data: { mfaTotpLastStep: totp.counter() },
    });
  });

  it("refuses a wrong code without touching the account", async () => {
    const { service, prisma, enc } = withSecret();
    const updateMany = vi.fn();
    (prisma.user as unknown as { updateMany: Mock }).updateMany = updateMany;

    await expect(service.acceptTotpCode("user-1", enc, "000000")).resolves.toBe(
      "invalid",
    );
    expect(updateMany).not.toHaveBeenCalled();
  });
});
