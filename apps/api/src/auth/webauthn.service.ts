import type {
  RemoveWebauthnCredentialResponseDto,
  WebauthnCredentialDto,
  WebauthnLoginOptionsResponseDto,
  WebauthnMfaOptionsResponseDto,
  WebauthnRegistrationOptionsDto,
  WebauthnRegistrationVerifyRequestDto,
} from "@loomkeep/shared";
import { ErrorCode } from "@loomkeep/shared";
import { HttpStatus, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { User, WebauthnCredential } from "@prisma/client";
import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/server";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import * as bcrypt from "bcryptjs";
import { AppException } from "../common/app.exception";
import { PrismaService } from "../prisma/prisma.service";
import { SecurityEventService } from "../security/security-event.service";

const RP_NAME = "Loomkeep";
/** Ceremony window — matches the other short-lived challenge tables (MfaLoginChallenge, EmailChangeRequest). */
const CHALLENGE_TTL_MINUTES = 5;

export interface VerifiedWebauthnLogin {
  user: User;
  /** Set when this assertion was the 2nd factor of an already password-verified login. */
  mfaLoginChallengeId: string | null;
}

@Injectable()
export class WebauthnService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly security: SecurityEventService,
  ) {}

  /** WEB_ORIGIN is the browser-facing origin (comma-separated) — see main.ts's CORS setup. Its hostname doubles as the WebAuthn RP ID, so self-hosters need no extra config. */
  private origins(): string[] {
    return this.configService
      .getOrThrow<string>("WEB_ORIGIN")
      .split(",")
      .map((o) => o.trim());
  }

  private rpID(): string {
    return new URL(this.origins()[0]).hostname;
  }

  async hasCredentials(userId: string): Promise<boolean> {
    const count = await this.prisma.webauthnCredential.count({
      where: { userId },
    });
    return count > 0;
  }

  async listCredentials(userId: string): Promise<WebauthnCredentialDto[]> {
    const rows = await this.prisma.webauthnCredential.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(toCredentialDto);
  }

  async getStatus(userId: string): Promise<{
    webauthnCredentials: WebauthnCredentialDto[];
    passwordlessEnabled: boolean;
  }> {
    const [webauthnCredentials, user] = await Promise.all([
      this.listCredentials(userId),
      this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { passwordlessEnabled: true },
      }),
    ]);
    return {
      webauthnCredentials,
      passwordlessEnabled: user.passwordlessEnabled,
    };
  }

  // --- Settings: adding a credential ---

  async registrationOptions(
    userId: string,
    email: string,
    displayName: string,
  ): Promise<WebauthnRegistrationOptionsDto> {
    const existing = await this.prisma.webauthnCredential.findMany({
      where: { userId },
      select: { credentialId: true, transports: true },
    });

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: this.rpID(),
      userID: new TextEncoder().encode(userId),
      userName: email,
      userDisplayName: displayName,
      attestationType: "none",
      excludeCredentials: existing.map((c) => ({
        id: c.credentialId,
        transports: c.transports as AuthenticatorTransportHint[],
      })),
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
      },
    });

    const challenge = await this.prisma.webauthnChallenge.create({
      data: {
        userId,
        challenge: options.challenge,
        expiresAt: new Date(Date.now() + CHALLENGE_TTL_MINUTES * 60_000),
      },
    });

    return { webauthnChallengeId: challenge.id, options };
  }

  async verifyRegistration(
    userId: string,
    dto: WebauthnRegistrationVerifyRequestDto,
  ): Promise<WebauthnCredentialDto> {
    const challenge = await this.prisma.webauthnChallenge.findUnique({
      where: { id: dto.webauthnChallengeId },
    });

    if (
      !challenge ||
      challenge.userId !== userId ||
      challenge.expiresAt < new Date()
    ) {
      if (challenge) {
        await this.prisma.webauthnChallenge.delete({
          where: { id: challenge.id },
        });
      }

      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.AuthWebauthnChallengeExpired,
      );
    }

    let verification;

    try {
      verification = await verifyRegistrationResponse({
        response: dto.response as RegistrationResponseJSON,
        expectedChallenge: challenge.challenge,
        expectedOrigin: this.origins(),
        expectedRPID: this.rpID(),
      });
    } catch {
      verification = { verified: false } as const;
    }

    await this.prisma.webauthnChallenge.delete({ where: { id: challenge.id } });

    if (!verification.verified) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.AuthWebauthnVerificationFailed,
      );
    }

    const { credential, credentialDeviceType, credentialBackedUp } =
      verification.registrationInfo;

    const row = await this.prisma.webauthnCredential.create({
      data: {
        userId,
        credentialId: credential.id,
        publicKey: Buffer.from(credential.publicKey),
        counter: BigInt(credential.counter),
        deviceType: credentialDeviceType,
        backedUp: credentialBackedUp,
        transports: credential.transports ?? [],
        name: dto.name.trim() || "Clé de sécurité",
      },
    });

    await this.security.record({
      type: "MFA_WEBAUTHN_ADDED",
      userId,
      detail: row.name,
    });

    return toCredentialDto(row);
  }

  async removeCredential(
    userId: string,
    credentialId: string,
    currentPassword: string,
    currentSessionId?: string,
  ): Promise<RemoveWebauthnCredentialResponseDto> {
    await this.assertCurrentPassword(userId, currentPassword);

    const row = await this.prisma.webauthnCredential.findUnique({
      where: { id: credentialId },
    });

    if (!row || row.userId !== userId) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.AuthWebauthnCredentialNotFound,
      );
    }

    await this.prisma.webauthnCredential.delete({ where: { id: row.id } });
    await this.security.record({
      type: "MFA_WEBAUTHN_REMOVED",
      userId,
      detail: row.name,
    });

    const remaining = await this.prisma.webauthnCredential.count({
      where: { userId },
    });
    let passwordlessDisabled = false;

    if (remaining === 0) {
      const user = await this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { passwordlessEnabled: true },
      });

      if (user.passwordlessEnabled) {
        await this.prisma.user.update({
          where: { id: userId },
          data: { passwordlessEnabled: false },
        });
        await this.security.record({
          type: "MFA_PASSWORDLESS_DISABLED",
          userId,
        });
        passwordlessDisabled = true;
      }
    }

    // Removing a credential — like disabling any other MFA method — should
    // invalidate other sessions that were relying on it.
    await this.prisma.refreshToken.deleteMany({
      where: currentSessionId
        ? { userId, id: { not: currentSessionId } }
        : { userId },
    });

    return { passwordlessDisabled };
  }

  async setPasswordless(
    userId: string,
    enabled: boolean,
    currentPassword: string,
    currentSessionId?: string,
  ): Promise<void> {
    await this.assertCurrentPassword(userId, currentPassword);

    if (enabled && !(await this.hasCredentials(userId))) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.AuthPasswordlessRequiresCredential,
      );
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { passwordlessEnabled: enabled },
      }),
      this.prisma.refreshToken.deleteMany({
        where: currentSessionId
          ? { userId, id: { not: currentSessionId } }
          : { userId },
      }),
    ]);

    await this.security.record({
      type: enabled ? "MFA_PASSWORDLESS_ENABLED" : "MFA_PASSWORDLESS_DISABLED",
      userId,
    });
  }

  // --- Login: MFA 2nd factor (password already verified) ---

  async createMfaChallenge(
    userId: string,
    mfaLoginChallengeId: string,
  ): Promise<WebauthnMfaOptionsResponseDto> {
    const { webauthnChallengeId, options } = await this.createLoginChallenge(
      userId,
      mfaLoginChallengeId,
    );
    return { webauthnChallengeId, options };
  }

  // --- Login: passwordless (no password verified at all) ---

  /** Returns null when the account isn't eligible — callers must respond identically to "unknown identifier" to avoid enumeration. */
  async passwordlessOptions(
    identifier: string,
  ): Promise<WebauthnLoginOptionsResponseDto | null> {
    const user = await this.prisma.user.findFirst({
      where: { OR: [{ email: identifier }, { username: identifier }] },
      select: { id: true, passwordlessEnabled: true },
    });

    if (!user?.passwordlessEnabled) return null;
    if (!(await this.hasCredentials(user.id))) return null;

    const { webauthnChallengeId, options } = await this.createLoginChallenge(
      user.id,
      null,
    );
    return { webauthnChallengeId, options };
  }

  private async createLoginChallenge(
    userId: string,
    mfaLoginChallengeId: string | null,
  ): Promise<{
    webauthnChallengeId: string;
    options: Awaited<ReturnType<typeof generateAuthenticationOptions>>;
  }> {
    const credentials = await this.prisma.webauthnCredential.findMany({
      where: { userId },
      select: { credentialId: true, transports: true },
    });

    const options = await generateAuthenticationOptions({
      rpID: this.rpID(),
      userVerification: "preferred",
      allowCredentials: credentials.map((c) => ({
        id: c.credentialId,
        transports: c.transports as AuthenticatorTransportHint[],
      })),
    });

    const challenge = await this.prisma.webauthnChallenge.create({
      data: {
        userId,
        mfaLoginChallengeId,
        challenge: options.challenge,
        expiresAt: new Date(Date.now() + CHALLENGE_TTL_MINUTES * 60_000),
      },
    });

    return { webauthnChallengeId: challenge.id, options };
  }

  /** Shared verification for both the MFA-step and passwordless login flows — identical crypto either way, they only differ in what happens after (see AuthService). */
  async verifyLoginAssertion(
    webauthnChallengeId: string,
    response: AuthenticationResponseJSON,
  ): Promise<VerifiedWebauthnLogin> {
    const challenge = await this.prisma.webauthnChallenge.findUnique({
      where: { id: webauthnChallengeId },
      include: { user: true },
    });

    if (!challenge || challenge.expiresAt < new Date()) {
      if (challenge) {
        await this.prisma.webauthnChallenge.delete({
          where: { id: challenge.id },
        });
      }

      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        ErrorCode.AuthWebauthnChallengeExpired,
      );
    }

    const credential = await this.prisma.webauthnCredential.findUnique({
      where: { credentialId: response.id },
    });

    if (!credential || credential.userId !== challenge.userId) {
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        ErrorCode.AuthWebauthnVerificationFailed,
      );
    }

    let verification;

    try {
      verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge: challenge.challenge,
        expectedOrigin: this.origins(),
        expectedRPID: this.rpID(),
        credential: toWebAuthnCredential(credential),
      });
    } catch {
      verification = { verified: false } as const;
    }

    await this.prisma.webauthnChallenge.delete({ where: { id: challenge.id } });

    if (!verification.verified) {
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        ErrorCode.AuthWebauthnVerificationFailed,
      );
    }

    await this.prisma.webauthnCredential.update({
      where: { id: credential.id },
      data: {
        counter: BigInt(verification.authenticationInfo.newCounter),
        lastUsedAt: new Date(),
      },
    });

    return {
      user: challenge.user,
      mfaLoginChallengeId: challenge.mfaLoginChallengeId,
    };
  }

  private async assertCurrentPassword(
    userId: string,
    currentPassword: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { passwordHash: true },
    });

    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        ErrorCode.AuthCurrentPasswordIncorrect,
      );
    }
  }
}

// Narrow string[] (Prisma) down to the literal union simplewebauthn expects —
// values only ever come from what the browser itself reported at registration.
type AuthenticatorTransportHint =
  "ble" | "cable" | "hybrid" | "internal" | "nfc" | "smart-card" | "usb";

function toWebAuthnCredential(row: WebauthnCredential) {
  return {
    id: row.credentialId,
    publicKey: new Uint8Array(row.publicKey),
    counter: Number(row.counter),
    transports: row.transports as AuthenticatorTransportHint[],
  };
}

function toCredentialDto(row: WebauthnCredential): WebauthnCredentialDto {
  return {
    id: row.id,
    name: row.name,
    deviceType: row.deviceType as WebauthnCredentialDto["deviceType"],
    createdAt: row.createdAt.toISOString(),
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
  };
}
