import type { ConfigService } from "@nestjs/config";
import type { User } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { Secret, TOTP } from "otpauth";
import { vi, type Mock } from "vitest";
import type { MailService } from "../mail/mail.service";
import type { PrismaService } from "../prisma/prisma.service";
import { encryptTotpSecret } from "./mfa-crypto.util";
import { MfaService, RECOVERY_CODE_COUNT } from "./mfa.service";

const ENCRYPTION_KEY = randomBytes(32).toString("base64");

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: "user-1",
    email: "alice@example.com",
    passwordHash: "irrelevant",
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
      findUniqueOrThrow: vi.fn(),
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
    $transaction: vi.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  } as unknown as PrismaService;

  const configService = {
    getOrThrow: vi.fn(() => ENCRYPTION_KEY),
  } as unknown as ConfigService;

  const mail = {} as unknown as MailService;

  return { service: new MfaService(prisma, configService, mail), prisma };
}

describe("MfaService recovery codes", () => {
  // bcryptjs hashes all 10 codes in parallel — pure-JS bcrypt is CPU-bound
  // enough that this can flirt with the default 5s timeout under load.
  it("generates 10 codes of 10 chars using only unambiguous characters", async () => {
    const { service } = makeService();
    const codes = await service.regenerateRecoveryCodes("user-1");

    expect(codes).toHaveLength(RECOVERY_CODE_COUNT);

    for (const code of codes) {
      expect(code).toHaveLength(10);
      expect(code).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{10}$/);
    }
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

    const first = await service.confirmTotp("user-1", code);
    expect(first.recoveryCodes).toHaveLength(RECOVERY_CODE_COUNT);

    const second = await service.setEmailMfaEnabled("user-1", true);
    expect(second.recoveryCodes).toBeUndefined();
  });

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

describe("MfaService.disableTotp", () => {
  it("rejects with the wrong current password", async () => {
    const { service, prisma } = makeService();
    (prisma.user.findUniqueOrThrow as Mock).mockResolvedValue(
      makeUser({ passwordHash: await bcrypt.hash("correct", 4) }),
    );

    await expect(service.disableTotp("user-1", "wrong")).rejects.toThrow();
  });

  it("clears the stored secret and flag on success", async () => {
    const { service, prisma } = makeService();
    (prisma.user.findUniqueOrThrow as Mock).mockResolvedValue(
      makeUser({ passwordHash: await bcrypt.hash("correct", 4) }),
    );

    await service.disableTotp("user-1", "correct");

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { mfaTotpEnabled: false, mfaTotpSecretEnc: null },
    });
  });
});
