import {
  ErrorCode,
  REAUTH_METHODS,
  REAUTH_WINDOW_MS,
  type ReauthRequestDto,
  type ReauthResultDto,
  type ReauthStatusDto,
} from "@loomkeep/shared";
import { HttpStatus, Injectable } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { AppException } from "../common/app.exception";
import { PrismaService } from "../prisma/prisma.service";
import { SecurityEventService } from "../security/security-event.service";
import { AuthService } from "./auth.service";
import { MfaService } from "./mfa.service";
import { WebauthnService } from "./webauthn.service";

/** Failed confirmations in a row before the session is signed out. */
export const MAX_REAUTH_FAILURES = 5;

/**
 * The confirmation sensitive actions ask for (see RecentAuthGuard): the
 * signed-in user proves it's them again with a passkey, their authenticator
 * app or their password, and their session lets those actions through for
 * REAUTH_WINDOW_MS.
 */
@Injectable()
export class ReauthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly mfa: MfaService,
    private readonly webauthn: WebauthnService,
    private readonly security: SecurityEventService,
  ) {}

  async status(userId: string, sessionId?: string): Promise<ReauthStatusDto> {
    const [user, hasKeys, session] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { mfaTotpEnabled: true },
      }),
      this.webauthn.hasCredentials(userId),
      sessionId
        ? this.prisma.refreshToken.findUnique({
            where: { id: sessionId },
            select: { reauthenticatedAt: true },
          })
        : null,
    ]);

    return {
      methods: REAUTH_METHODS.filter((method) =>
        method === "webauthn"
          ? hasKeys
          : method === "totp"
            ? user.mfaTotpEnabled
            : true,
      ),
      confirmedUntil: confirmedUntil(session?.reauthenticatedAt ?? null),
    };
  }

  webauthnOptions(userId: string) {
    return this.webauthn.reauthOptions(userId);
  }

  async confirm(
    userId: string,
    sessionId: string | undefined,
    dto: ReauthRequestDto,
  ): Promise<ReauthResultDto> {
    // Only a browser session can be confirmed: an API key never gets this far.
    if (!sessionId) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        ErrorCode.AuthReauthRequired,
      );
    }

    try {
      await this.verify(userId, dto);
    } catch (error) {
      await this.recordFailure(userId, sessionId);
      throw error;
    }

    const session = await this.prisma.refreshToken.update({
      where: { id: sessionId },
      data: { reauthenticatedAt: new Date(), reauthFailures: 0 },
      select: { reauthenticatedAt: true },
    });
    return { confirmedUntil: confirmedUntil(session.reauthenticatedAt)! };
  }

  // A wrong proof answers 400, not 401: the web client reads a 401 as an
  // expired access token and would replay the attempt after a refresh.
  private async verify(userId: string, dto: ReauthRequestDto): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        passwordHash: true,
        mfaTotpEnabled: true,
        mfaTotpSecretEnc: true,
      },
    });

    switch (dto.method) {
      case "password":
        if (
          !dto.password ||
          !(await bcrypt.compare(dto.password, user.passwordHash))
        ) {
          throw wrongProof(ErrorCode.AuthCurrentPasswordIncorrect);
        }

        return;

      case "totp": {
        const accepted =
          user.mfaTotpEnabled && user.mfaTotpSecretEnc && dto.code
            ? await this.mfa.acceptTotpCode(
                userId,
                user.mfaTotpSecretEnc,
                dto.code,
              )
            : "invalid";

        if (accepted === "reused") {
          throw wrongProof(ErrorCode.AuthTotpCodeReused);
        }

        if (accepted === "invalid") {
          throw wrongProof(ErrorCode.AuthMfaInvalidCode);
        }

        return;
      }

      case "webauthn":
        if (!dto.webauthnChallengeId || !dto.response) {
          throw wrongProof(ErrorCode.AuthWebauthnVerificationFailed);
        }

        try {
          await this.webauthn.verifyReauth(
            userId,
            dto.webauthnChallengeId,
            dto.response,
          );
        } catch (error) {
          throw error instanceof AppException ? wrongProof(error.code) : error;
        }

        return;
    }
  }

  private async recordFailure(
    userId: string,
    sessionId: string,
  ): Promise<void> {
    const { reauthFailures } = await this.prisma.refreshToken.update({
      where: { id: sessionId },
      data: { reauthFailures: { increment: 1 } },
      select: { reauthFailures: true },
    });
    if (reauthFailures < MAX_REAUTH_FAILURES) return;

    await this.auth.revokeSession(userId, sessionId);
    await this.security.record({ type: "REAUTH_LOCKED", userId });
    throw new AppException(
      HttpStatus.FORBIDDEN,
      ErrorCode.AuthReauthTooManyAttempts,
    );
  }
}

function confirmedUntil(reauthenticatedAt: Date | null): string | null {
  if (!reauthenticatedAt) return null;
  const until = reauthenticatedAt.getTime() + REAUTH_WINDOW_MS;
  return until > Date.now() ? new Date(until).toISOString() : null;
}

function wrongProof(code: ErrorCode): AppException {
  return new AppException(HttpStatus.BAD_REQUEST, code);
}
