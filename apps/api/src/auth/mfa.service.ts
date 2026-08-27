import { ErrorCode } from "@loomkeep/shared";
import { HttpStatus, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";
import { Secret, TOTP } from "otpauth";
import { AppException } from "../common/app.exception";
import { MailService } from "../mail/mail.service";
import { PrismaService } from "../prisma/prisma.service";
import { BCRYPT_ROUNDS } from "./auth.service";
import { decryptTotpSecret, encryptTotpSecret } from "./mfa-crypto.util";

export const RECOVERY_CODE_COUNT = 10;
const RECOVERY_CODE_LENGTH = 10;
// Excludes ambiguous characters (0/O, 1/I/L) so codes are easy to read/type back.
const RECOVERY_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const TOTP_ISSUER = "Loomkeep";

@Injectable()
export class MfaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly mail: MailService,
  ) {}

  private getEncryptionKey(): Buffer {
    const key = Buffer.from(
      this.configService.getOrThrow<string>("MFA_ENCRYPTION_KEY"),
      "base64",
    );

    if (key.length !== 32) {
      throw new Error("MFA_ENCRYPTION_KEY must decode to exactly 32 bytes");
    }

    return key;
  }

  /**
   * Generates a fresh TOTP secret and persists it encrypted right away, with
   * `mfaTotpEnabled` left false until `confirmTotp` validates a live code —
   * so a user who closes the setup modal without confirming just leaves an
   * inert secret that the next setup attempt overwrites.
   */
  async generateTotpSetup(
    userId: string,
    email: string,
  ): Promise<{ otpauthUri: string; secret: string }> {
    const secret = new Secret({ size: 20 });
    const totp = new TOTP({
      issuer: TOTP_ISSUER,
      label: email,
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret,
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        mfaTotpSecretEnc: encryptTotpSecret(
          secret.base32,
          this.getEncryptionKey(),
        ),
      },
    });

    return { otpauthUri: totp.toString(), secret: secret.base32 };
  }

  async confirmTotp(
    userId: string,
    code: string,
  ): Promise<{ recoveryCodes?: string[] }> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    if (!user.mfaTotpSecretEnc) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.AuthMfaTotpNotInProgress,
      );
    }

    if (!this.validateTotpCode(user.mfaTotpSecretEnc, code)) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.AuthMfaInvalidCode,
      );
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaTotpEnabled: true },
    });

    return { recoveryCodes: await this.ensureRecoveryCodes(userId) };
  }

  async disableTotp(userId: string, currentPassword: string): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        ErrorCode.AuthCurrentPasswordIncorrect,
      );
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaTotpEnabled: false, mfaTotpSecretEnc: null },
    });
  }

  async setEmailMfaEnabled(
    userId: string,
    enabled: boolean,
  ): Promise<{ recoveryCodes?: string[] }> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEmailEnabled: enabled },
    });

    if (!enabled) return {};
    return { recoveryCodes: await this.ensureRecoveryCodes(userId) };
  }

  async getMfaStatus(userId: string): Promise<{
    totpEnabled: boolean;
    emailEnabled: boolean;
    recoveryCodesRemaining: number;
  }> {
    const [user, recoveryCodesRemaining] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { mfaTotpEnabled: true, mfaEmailEnabled: true },
      }),
      this.prisma.mfaRecoveryCode.count({ where: { userId } }),
    ]);
    return {
      totpEnabled: user.mfaTotpEnabled,
      emailEnabled: user.mfaEmailEnabled,
      recoveryCodesRemaining,
    };
  }

  /** Generates a fresh batch of 10, deleting any existing ones first. */
  async regenerateRecoveryCodes(userId: string): Promise<string[]> {
    return this.generateRecoveryCodes(userId, { deleteExisting: true });
  }

  /** Only generates if the user has none yet — called when a first MFA method is enabled. */
  private async ensureRecoveryCodes(
    userId: string,
  ): Promise<string[] | undefined> {
    const existing = await this.prisma.mfaRecoveryCode.count({
      where: { userId },
    });
    if (existing > 0) return undefined;
    return this.generateRecoveryCodes(userId, { deleteExisting: false });
  }

  private async generateRecoveryCodes(
    userId: string,
    { deleteExisting }: { deleteExisting: boolean },
  ): Promise<string[]> {
    const codes = Array.from({ length: RECOVERY_CODE_COUNT }, () =>
      generateRecoveryCode(),
    );
    const hashed = await Promise.all(
      codes.map((code) => bcrypt.hash(code, BCRYPT_ROUNDS)),
    );

    await this.prisma.$transaction([
      ...(deleteExisting
        ? [this.prisma.mfaRecoveryCode.deleteMany({ where: { userId } })]
        : []),
      ...hashed.map((codeHash) =>
        this.prisma.mfaRecoveryCode.create({ data: { userId, codeHash } }),
      ),
    ]);

    return codes;
  }

  /** Normalizes (strips separators, uppercases), matches, and deletes the consumed row. */
  async verifyRecoveryCode(userId: string, rawCode: string): Promise<boolean> {
    const normalized = rawCode.replace(/[\s-]/g, "").toUpperCase();
    const rows = await this.prisma.mfaRecoveryCode.findMany({
      where: { userId },
    });

    for (const row of rows) {
      if (await bcrypt.compare(normalized, row.codeHash)) {
        await this.prisma.mfaRecoveryCode.delete({ where: { id: row.id } });
        return true;
      }
    }

    return false;
  }

  /** Decrypts the stored secret and validates a live 6-digit TOTP code, +-1 step of drift. */
  validateTotpCode(mfaTotpSecretEnc: string, code: string): boolean {
    if (!/^\d{6}$/.test(code)) return false;
    const secret = decryptTotpSecret(mfaTotpSecretEnc, this.getEncryptionKey());
    const totp = new TOTP({
      issuer: TOTP_ISSUER,
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: Secret.fromBase32(secret),
    });
    return totp.validate({ token: code, window: 1 }) !== null;
  }
}

function generateRecoveryCode(): string {
  let code = "";

  for (let i = 0; i < RECOVERY_CODE_LENGTH; i++) {
    code += RECOVERY_CODE_ALPHABET[randomInt(0, RECOVERY_CODE_ALPHABET.length)];
  }

  return code;
}
