import type {
  AuthTokensDto,
  Locale,
  SessionDto,
  UserDto,
} from "@loomkeep/shared";
import { deviceLabel, LEGAL_VERSION } from "@loomkeep/shared";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import type { User } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { HibpService } from "../common/hibp.service";
import { FeatureFlagsService } from "../feature-flags/feature-flags.service";
import { MailService } from "../mail/mail.service";
import { PrismaService } from "../prisma/prisma.service";
import { SecurityEventService } from "../security/security-event.service";
import { avatarUrl } from "../users/avatar.util";
import { randomUsernameSuffix, slugifyUsername } from "../users/username.util";
import type { JwtPayload } from "./decorators/current-user.decorator";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { isRegistrationEnabled } from "./registration.config";
import { TurnstileService } from "./turnstile.service";

const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL_DAYS = 30;
const RESET_TOKEN_TTL_MINUTES = 60;
const VERIFY_TOKEN_TTL_HOURS = 24;
export const BCRYPT_ROUNDS = 12;

export interface AuthResult {
  user: UserDto;
  tokens: AuthTokensDto;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mail: MailService,
    private readonly security: SecurityEventService,
    private readonly turnstile: TurnstileService,
    private readonly hibp: HibpService,
    private readonly flags: FeatureFlagsService,
  ) {}

  async register(
    dto: RegisterDto,
    userAgent?: string,
    ip?: string,
    acceptLanguage?: string,
  ): Promise<AuthResult> {
    if (!isRegistrationEnabled(this.configService, this.flags)) {
      throw new ForbiddenException("Registration is disabled");
    }

    if (!(await this.turnstile.verify(dto.turnstileToken, ip))) {
      throw new BadRequestException("Anti-bot verification failed");
    }

    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException("An account with this email already exists");
    }

    if (await this.hibp.isPasswordPwned(dto.password)) {
      throw new BadRequestException(
        "This password has appeared in a known data breach — please choose a different one",
      );
    }

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash: await bcrypt.hash(dto.password, BCRYPT_ROUNDS),
        displayName: dto.displayName,
        username: await this.generateUniqueUsername(dto.displayName),
        locale: detectLocale(acceptLanguage),
        acceptedTermsAt: new Date(),
        acceptedTermsVersion: LEGAL_VERSION,
        certifiedAgeAt: new Date(),
        lastActiveAt: new Date(),
      },
    });

    const verifyToken = randomBytes(32).toString("hex");
    await this.prisma.userToken.create({
      data: {
        userId: user.id,
        type: "EMAIL_VERIFICATION",
        tokenHash: hashToken(verifyToken),
        expiresAt: new Date(Date.now() + VERIFY_TOKEN_TTL_HOURS * 60 * 60_000),
      },
    });
    await this.mail.sendWelcome(user.email, user.displayName);
    await this.mail.sendVerifyEmail(user.email, verifyToken);
    await this.security.record({
      type: "USER_REGISTERED",
      userId: user.id,
      identifier: user.email,
      userAgent,
    });
    // Seed this device so it isn't flagged as "new" on the user's next login.
    await this.recordDevice(user.id, userAgent);

    const promoted = await this.ensureAdminRole(user);
    return {
      user: toUserDto(promoted),
      tokens: await this.startSession(promoted, userAgent),
    };
  }

  /** Consumes an email-verification link. Informational only — nothing is gated on it. */
  async verifyEmail(token: string): Promise<void> {
    const stored = await this.prisma.userToken.findUnique({
      where: { tokenHash: hashToken(token) },
    });

    if (
      !stored ||
      stored.type !== "EMAIL_VERIFICATION" ||
      stored.expiresAt < new Date()
    ) {
      throw new UnauthorizedException("Invalid or expired verification token");
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: stored.userId },
        data: { emailVerified: true },
      }),
      this.prisma.userToken.deleteMany({
        where: { userId: stored.userId, type: "EMAIL_VERIFICATION" },
      }),
    ]);
  }

  /**
   * Re-sends the email-verification link, replacing any previous token —
   * the admin "renvoyer l'email de vérification" action. Verification is
   * informational only (see verifyEmail()), so an already-verified account
   * has nothing to resend.
   */
  async resendVerificationEmail(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    if (user.emailVerified) {
      throw new BadRequestException("This account is already verified");
    }

    const verifyToken = randomBytes(32).toString("hex");
    await this.prisma.$transaction([
      this.prisma.userToken.deleteMany({
        where: { userId: user.id, type: "EMAIL_VERIFICATION" },
      }),
      this.prisma.userToken.create({
        data: {
          userId: user.id,
          type: "EMAIL_VERIFICATION",
          tokenHash: hashToken(verifyToken),
          expiresAt: new Date(
            Date.now() + VERIFY_TOKEN_TTL_HOURS * 60 * 60_000,
          ),
        },
      }),
    ]);
    await this.mail.sendVerifyEmail(user.email, verifyToken);
  }

  /** Accepts either the email or the username as the login identifier. */
  async login(
    dto: LoginDto,
    userAgent?: string,
    ip?: string,
  ): Promise<AuthResult> {
    const user = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.identifier }, { username: dto.identifier }] },
    });

    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      await this.security.record({
        type: "LOGIN_FAILED",
        userId: user?.id ?? null,
        identifier: dto.identifier,
        userAgent,
      });
      throw new UnauthorizedException("Invalid credentials");
    }

    const promoted = await this.ensureAdminRole(user);
    const isNewDevice = await this.recordDevice(promoted.id, userAgent);
    await this.touchActivity(promoted.id);
    const tokens = await this.startSession(promoted, userAgent);

    if (isNewDevice) {
      const label = deviceLabel(userAgent) ?? "Appareil inconnu";
      await this.mail.sendNewDeviceLogin(promoted.email, label, ip ?? null);
      await this.security.record({
        type: "NEW_DEVICE_LOGIN",
        userId: promoted.id,
        identifier: promoted.email,
        detail: ip ? `IP: ${ip}` : undefined,
        userAgent,
      });
    }

    return { user: toUserDto(promoted), tokens };
  }

  /**
   * Rotates the refresh token in place: the presented one is consumed and the
   * session row is updated (new token/jti, bumped lastUsedAt) rather than
   * replaced, so the device keeps its identity and original createdAt.
   */
  async refresh(refreshToken: string): Promise<AuthTokensDto> {
    try {
      await this.jwtService.verifyAsync(refreshToken, {
        secret: this.configService.getOrThrow<string>("JWT_REFRESH_SECRET"),
      });
    } catch {
      throw new UnauthorizedException("Invalid or expired refresh token");
    }

    const tokenHash = hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException("Unknown or expired refresh token");
    }

    const signed = await this.signTokens(stored.user);
    await this.prisma.$transaction([
      this.prisma.refreshToken.update({
        where: { id: stored.id },
        data: {
          tokenHash: hashToken(signed.refreshToken),
          jti: signed.jti,
          expiresAt: signed.expiresAt,
          lastUsedAt: new Date(),
        },
      }),
      this.touchActivityQuery(stored.user.id),
    ]);
    return {
      accessToken: signed.accessToken,
      refreshToken: signed.refreshToken,
    };
  }

  /** Invalidates one refresh token (logout on the current device). */
  async logout(refreshToken: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({
      where: { tokenHash: hashToken(refreshToken) },
    });
  }

  /**
   * Every signed-in device for this user, most-recently-active first.
   * Expired tokens are dead (refresh() already rejects them) but were never
   * removed, so they'd otherwise pile up here as phantom "connected" devices
   * across app restarts — prune them first.
   */
  async listSessions(userId: string): Promise<SessionDto[]> {
    await this.prisma.refreshToken.deleteMany({
      where: { userId, expiresAt: { lt: new Date() } },
    });

    const sessions = await this.prisma.refreshToken.findMany({
      where: { userId },
      orderBy: { lastUsedAt: "desc" },
    });
    return sessions.map((s) => ({
      id: s.id,
      jti: s.jti,
      userAgent: s.userAgent,
      createdAt: s.createdAt.toISOString(),
      lastUsedAt: s.lastUsedAt.toISOString(),
    }));
  }

  /** Revokes one session by id, scoped to its owner so ids can't be guessed across users. */
  async revokeSession(userId: string, sessionId: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({
      where: { id: sessionId, userId },
    });
  }

  /** Revokes every session except the current device (identified by its jti). */
  async revokeOtherSessions(userId: string, exceptJti: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({
      where: { userId, jti: { not: exceptJti } },
    });
  }

  /** Revokes every session for an account, no exception — the admin "forcer la déconnexion" action. */
  async revokeAllSessions(userId: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({ where: { userId } });
  }

  /**
   * Generates a fresh reset token for the account, invalidating any previous
   * one, and emails it as a link. Silently no-ops when the email doesn't
   * match an account, so the controller's response shape doesn't leak which
   * emails are registered.
   */
  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return;

    const token = randomBytes(32).toString("hex");
    await this.prisma.$transaction([
      this.prisma.userToken.deleteMany({
        where: { userId: user.id, type: "PASSWORD_RESET" },
      }),
      this.prisma.userToken.create({
        data: {
          userId: user.id,
          type: "PASSWORD_RESET",
          tokenHash: hashToken(token),
          expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60_000),
        },
      }),
    ]);
    await this.mail.sendPasswordResetLink(user.email, token);
  }

  /**
   * Consumes a reset token: sets the new password and revokes every existing
   * session (the password may have been reset because it leaked).
   */
  async resetPassword(
    token: string,
    newPassword: string,
    userAgent?: string,
  ): Promise<void> {
    const stored = await this.prisma.userToken.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: true },
    });

    if (
      !stored ||
      stored.type !== "PASSWORD_RESET" ||
      stored.expiresAt < new Date()
    ) {
      throw new UnauthorizedException("Invalid or expired reset token");
    }

    if (await this.hibp.isPasswordPwned(newPassword)) {
      throw new BadRequestException(
        "This password has appeared in a known data breach — please choose a different one",
      );
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: stored.userId },
        data: { passwordHash: await bcrypt.hash(newPassword, BCRYPT_ROUNDS) },
      }),
      this.prisma.userToken.deleteMany({
        where: { userId: stored.userId, type: "PASSWORD_RESET" },
      }),
      this.prisma.refreshToken.deleteMany({
        where: { userId: stored.userId },
      }),
    ]);
    await this.mail.sendPasswordChanged(stored.user.email);
    await this.security.record({
      type: "PASSWORD_RESET",
      userId: stored.userId,
      identifier: stored.user.email,
      userAgent,
    });
  }

  /**
   * Self-host bootstrap: grants the `ADMIN` role to the account whose email
   * matches `ADMIN_EMAIL`. Idempotent, and run on register *and* every login
   * so it also promotes an account created before the env var was set.
   * Hosted mode leaves `ADMIN_EMAIL` unset — there admin is granted per-account
   * from the admin panel instead.
   */
  private async ensureAdminRole(user: User): Promise<User> {
    const adminEmail = this.configService.get<string>("ADMIN_EMAIL");

    if (!adminEmail || user.email.toLowerCase() !== adminEmail.toLowerCase()) {
      return user;
    }

    if (user.role === "ADMIN") {
      return user;
    }

    return this.prisma.user.update({
      where: { id: user.id },
      data: { role: "ADMIN" },
    });
  }

  /** Slugifies `seed` into a username, appending a random suffix on collision. */
  private async generateUniqueUsername(seed: string): Promise<string> {
    const base = slugifyUsername(seed);

    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate =
        attempt === 0 ? base : `${base}${randomUsernameSuffix(4)}`;
      const existing = await this.prisma.user.findUnique({
        where: { username: candidate },
        select: { id: true },
      });
      if (!existing) return candidate;
    }

    return `${base}${randomUsernameSuffix(8)}`;
  }

  /** Signs a fresh access/refresh pair. Persistence is the caller's job. */
  private async signTokens(user: User): Promise<{
    accessToken: string;
    refreshToken: string;
    jti: string;
    expiresAt: Date;
  }> {
    const payload: JwtPayload = { sub: user.id, email: user.email };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow<string>("JWT_ACCESS_SECRET"),
      expiresIn: ACCESS_TOKEN_TTL,
    });
    // jti makes each refresh token unique even when issued within the same second,
    // and identifies the session row.
    const jti = randomUUID();
    const refreshToken = await this.jwtService.signAsync(
      { sub: user.id, jti },
      {
        secret: this.configService.getOrThrow<string>("JWT_REFRESH_SECRET"),
        expiresIn: `${REFRESH_TOKEN_TTL_DAYS}d`,
      },
    );

    const expiresAt = new Date(
      Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
    );
    return { accessToken, refreshToken, jti, expiresAt };
  }

  /**
   * Bumps `User.lastActiveAt` and clears any pending inactivity warning — see
   * LK-C06. Called on register, login and refresh, so a session kept alive
   * purely by silent refresh (no re-entered credentials) still counts as
   * activity.
   */
  private touchActivityQuery(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { lastActiveAt: new Date(), inactivityWarningSentAt: null },
    });
  }

  private async touchActivity(userId: string): Promise<void> {
    await this.touchActivityQuery(userId);
  }

  /**
   * Upserts the (userId, deviceKey) row for this browser, where deviceKey is
   * the normalized browser+OS label rather than the raw User-Agent — a
   * version bump (Chrome 139 -> 140) shouldn't read as a new device. Returns
   * whether this is the first time this device has been seen, so the caller
   * can decide whether to raise a new-device alert.
   */
  private async recordDevice(
    userId: string,
    userAgent?: string,
  ): Promise<boolean> {
    const deviceKey = deviceLabel(userAgent) ?? "unknown";
    const existing = await this.prisma.userDevice.findUnique({
      where: { userId_deviceKey: { userId, deviceKey } },
    });

    if (existing) {
      await this.prisma.userDevice.update({
        where: { id: existing.id },
        data: {
          userAgent: userAgent ?? existing.userAgent,
          lastSeenAt: new Date(),
        },
      });
      return false;
    }

    await this.prisma.userDevice.create({
      data: { userId, deviceKey, userAgent: userAgent ?? null },
    });
    return true;
  }

  /**
   * Opens a new session (login/register): signs tokens and records the device.
   * Drops any existing session already recorded for the same device first —
   * otherwise logging back in from the same browser after its old tokens went
   * stale (cleared storage, app restart, ...) just piles up another row next
   * to the dead one instead of replacing it.
   */
  private async startSession(
    user: User,
    userAgent?: string,
  ): Promise<AuthTokensDto> {
    const signed = await this.signTokens(user);
    await this.prisma.refreshToken.deleteMany({
      where: { userId: user.id, userAgent: userAgent ?? null },
    });
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(signed.refreshToken),
        jti: signed.jti,
        userAgent: userAgent ?? null,
        expiresAt: signed.expiresAt,
      },
    });
    return {
      accessToken: signed.accessToken,
      refreshToken: signed.refreshToken,
    };
  }
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** First tag of the Accept-Language header, "fr" if it starts with "fr", "en" otherwise (covers "no header" too). */
function detectLocale(acceptLanguage?: string): string {
  const first = acceptLanguage?.split(",")[0]?.trim().toLowerCase();
  return first?.startsWith("fr") ? "fr" : "en";
}

export function toUserDto(user: User): UserDto {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    displayName: user.displayName,
    birthDate: user.birthDate
      ? user.birthDate.toISOString().slice(0, 10)
      : null,
    allowAdultContent: user.allowAdultContent,
    notifyEmail: user.notifyEmail,
    notifyPush: user.notifyPush,
    notifyNewsletter: user.notifyNewsletter,
    emailVerified: user.emailVerified,
    role: user.role,
    enabledDomains: user.enabledDomains,
    mobileNavShortcuts: user.mobileNavShortcuts,
    bio: user.bio,
    defaultReviewVisibility:
      user.defaultReviewVisibility as UserDto["defaultReviewVisibility"],
    defaultListVisibility:
      user.defaultListVisibility as UserDto["defaultListVisibility"],
    profileAccess: user.profileAccess as UserDto["profileAccess"],
    locale: user.locale as Locale,
    createdAt: user.createdAt.toISOString(),
    avatarUrl: avatarUrl(user),
    onboardedAt: user.onboardedAt?.toISOString() ?? null,
    acceptedTermsVersion: user.acceptedTermsVersion,
  };
}
