import {
  Domain,
  ErrorCode,
  LEGAL_VERSION,
  UserDto,
  UsernameAvailabilityDto,
  type AccountDeletionSummaryDto,
  type CalendarTokenDto,
  type CsvExportDto,
  type EntitlementDto,
  type SocialProfileDto,
  type UserDataExportDto,
  type WidgetTokenDto,
} from "@loomkeep/shared";
import { HttpStatus, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { User } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { randomBytes, randomInt } from "node:crypto";
import { BCRYPT_ROUNDS, hashToken, toUserDto } from "../auth/auth.service";
import { AppException } from "../common/app.exception";
import { HibpService } from "../common/hibp.service";
import { parseEnumParam } from "../common/parse-enum-param.util";
import { EntitlementService } from "../entitlements/entitlement.service";
import { MailService } from "../mail/mail.service";
import { PrismaService } from "../prisma/prisma.service";
import { SecurityEventService } from "../security/security-event.service";
import { ProfileService } from "../social/profile.service";
import { AccountDeletionService } from "./account-deletion.service";
import { isAdult } from "./age.util";
import { matchesMimeType } from "./avatar.util";
import { CsvExportService } from "./csv-export.service";
import { DataExportService } from "./data-export.service";
import type { ChangeEmailDto } from "./dto/change-email.dto";
import type { ChangePasswordDto } from "./dto/change-password.dto";
import type { ConfirmEmailChangeDto } from "./dto/confirm-email-change.dto";
import type { DeleteAccountDto } from "./dto/delete-account.dto";
import type { UpdateUserDto } from "./dto/update-user.dto";
import type { UpdateUsernameDto } from "./dto/update-username.dto";
import type { UploadAvatarDto } from "./dto/upload-avatar.dto";
import { signWidgetToken } from "./widget-token.util";

// Decoded byte ceiling for an uploaded avatar — base64 for this is checked by
// UploadAvatarDto's MaxLength, this is the belt-and-suspenders check on the
// actual decoded buffer.
const MAX_AVATAR_BYTES = 2.5 * 1024 * 1024;

const EMAIL_CHANGE_TTL_MINUTES = 15;
const MAX_EMAIL_CHANGE_ATTEMPTS = 5;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly security: SecurityEventService,
    private readonly dataExport: DataExportService,
    private readonly csvExport: CsvExportService,
    private readonly config: ConfigService,
    private readonly hibp: HibpService,
    private readonly entitlements: EntitlementService,
    private readonly profiles: ProfileService,
    private readonly accountDeletion: AccountDeletionService,
  ) {}

  async getMe(userId: string): Promise<UserDto> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.UserAccountNotFound,
        undefined,
        "User not found",
      );
    }

    return toUserDto(user);
  }

  /**
   * Your own profile. Deliberately served here rather than through
   * `GET /social/users/:username`: that whole controller sits behind
   * `SocialFeatureGuard`, so on a SOCIAL_ENABLED=false instance the profile
   * page — level, XP, streak, per-domain counts, none of them social — had
   * no endpoint at all and rendered as "not found".
   */
  async getMyProfile(userId: string): Promise<SocialProfileDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { username: true },
    });

    if (!user) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.UserAccountNotFound,
      );
    }

    return this.profiles.getProfile(userId, user.username);
  }

  /**
   * Signs a short-lived (5 min) SSO token for Quackback's feedback widget
   * "Verified identity only" mode — the widget trusts this signature
   * instead of asking the visitor to type in their own email. Re-signed on
   * every call rather than cached, since it always expires quickly anyway.
   */
  async getWidgetToken(userId: string, email: string): Promise<WidgetTokenDto> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { displayName: true },
    });

    const ssoToken = signWidgetToken(
      {
        sub: userId,
        email,
        name: user.displayName,
        exp: Math.floor(Date.now() / 1000) + 300,
      },
      this.config.getOrThrow<string>("QUACKBACK_WIDGET_SECRET"),
    );

    return { ssoToken };
  }

  async getAvatar(
    id: string,
  ): Promise<{ avatar: Buffer; avatarMimeType: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { avatar: true, avatarMimeType: true },
    });

    if (!user?.avatar || !user.avatarMimeType) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.UserAvatarNotFound,
      );
    }

    return {
      avatar: Buffer.from(user.avatar),
      avatarMimeType: user.avatarMimeType,
    };
  }

  /** Replaces the account's profile picture. */
  async uploadAvatar(userId: string, dto: UploadAvatarDto): Promise<UserDto> {
    const buffer = Buffer.from(dto.data, "base64");

    if (buffer.length === 0 || buffer.length > MAX_AVATAR_BYTES) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.UserAvatarTooLarge,
      );
    }

    if (!matchesMimeType(buffer, dto.mimeType)) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.UserAvatarInvalidType,
        undefined,
        "File does not match the declared image type",
      );
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        avatar: buffer,
        avatarMimeType: dto.mimeType,
        avatarUpdatedAt: new Date(),
      },
    });
    return toUserDto(user);
  }

  /** Clears the profile picture — the client falls back to the identicon. */
  async deleteAvatar(userId: string): Promise<UserDto> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { avatar: null, avatarMimeType: null, avatarUpdatedAt: null },
    });
    return toUserDto(user);
  }

  /** Full portable dump of the account's data (GDPR "download my data"). */
  exportData(userId: string): Promise<UserDataExportDto> {
    return this.dataExport.buildExport(userId);
  }

  /**
   * Flat per-domain CSV, meant for migrating to another tool rather than the
   * GDPR dump above. Deliberately not gated by `enabledDomains` — a domain the
   * user hid from their own nav is still theirs to export.
   */
  async exportCsv(userId: string, domainParam: string): Promise<CsvExportDto> {
    const domain = parseEnumParam(domainParam, Object.values(Domain), "domain");
    return { csv: await this.csvExport.buildCsv(userId, domain) };
  }

  /**
   * Returns the token for the user's public .ics calendar subscription URL,
   * generating one on first call. Stable across calls — use the regenerate
   * endpoint below to revoke a previously shared link. Premium
   * (docs/adr/0001-open-core-agpl.md) — see LibraryService#getCalendarIcs
   * for the matching check on the feed itself.
   */
  async getCalendarToken(userId: string): Promise<CalendarTokenDto> {
    await this.requirePremium(userId);

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { calendarToken: true },
    });

    if (user.calendarToken) {
      return { token: user.calendarToken };
    }

    const { calendarToken } = await this.prisma.user.update({
      where: { id: userId },
      data: { calendarToken: randomBytes(24).toString("base64url") },
      select: { calendarToken: true },
    });
    return { token: calendarToken! };
  }

  /** Issues a new token, invalidating any previously shared .ics link. Premium. */
  async regenerateCalendarToken(userId: string): Promise<CalendarTokenDto> {
    await this.requirePremium(userId);

    const { calendarToken } = await this.prisma.user.update({
      where: { id: userId },
      data: { calendarToken: randomBytes(24).toString("base64url") },
      select: { calendarToken: true },
    });
    return { token: calendarToken! };
  }

  /**
   * The user's real plan (not gated by `premium-features` — see
   * `EntitlementService#isEffectivelyPremium`) so the web can decide what to
   * lock: `showLock = flag on && !isPremium`.
   */
  async getMyEntitlement(userId: string): Promise<EntitlementDto> {
    return { isPremium: await this.entitlements.hasPremium(userId) };
  }

  private async requirePremium(userId: string): Promise<void> {
    if (!(await this.entitlements.isEffectivelyPremium(userId))) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        ErrorCode.UserPremiumRequired,
        undefined,
        "This feature is reserved for premium accounts",
      );
    }
  }

  /** Marks the mandatory first-run onboarding wizard as done. Idempotent. */
  async completeOnboarding(userId: string): Promise<UserDto> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { onboardedAt: new Date() },
    });
    return toUserDto(user);
  }

  /**
   * Records re-acceptance of the current CGU (LK-C03) — the blocking
   * app/+layout.svelte prompt shown when acceptedTermsVersion no longer
   * matches LEGAL_VERSION.
   */
  async acceptTerms(userId: string): Promise<UserDto> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        acceptedTermsAt: new Date(),
        acceptedTermsVersion: LEGAL_VERSION,
      },
    });
    return toUserDto(user);
  }

  async updateMe(userId: string, dto: UpdateUserDto): Promise<UserDto> {
    if (dto.birthDate && new Date(dto.birthDate) > new Date()) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.UserBirthDateFuture,
        undefined,
        "Birth date cannot be in the future",
      );
    }

    const current = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        birthDate: true,
        allowAdultContent: true,
        notifyNewsletter: true,
      },
    });

    if (!current) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.UserAccountNotFound,
        undefined,
        "User not found",
      );
    }

    // Proof-of-consent timestamp (GDPR art. 7(1)): only stamped on the
    // false → true transition, never overwritten afterwards (a later opt-out
    // leaves it as the historical record of when consent was last given).
    const newsletterOptInAt =
      dto.notifyNewsletter === true && !current.notifyNewsletter
        ? new Date()
        : undefined;

    const nextBirthDate =
      dto.birthDate === undefined
        ? current.birthDate
        : dto.birthDate === null
          ? null
          : new Date(dto.birthDate);

    let nextAllowAdultContent =
      dto.allowAdultContent ?? current.allowAdultContent;

    if (nextAllowAdultContent && !isAdult(nextBirthDate)) {
      if (dto.allowAdultContent === true) {
        throw new AppException(
          HttpStatus.BAD_REQUEST,
          ErrorCode.UserAdultContentRequiresBirthDate,
          undefined,
          "Adult content requires a birth date confirming the account is 18+",
        );
      }

      // The birth date changed under a previously-enabled flag: turn it off quietly.
      nextAllowAdultContent = false;
    }

    // The "menu" launcher must always be reachable from the bottom bar.
    if (dto.mobileNavShortcuts && !dto.mobileNavShortcuts.includes("menu")) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.UserMobileNavMissingMenu,
        undefined,
        'mobileNavShortcuts must include the "menu" launcher',
      );
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        displayName: dto.displayName,
        birthDate: nextBirthDate,
        allowAdultContent: nextAllowAdultContent,
        notifyEmail: dto.notifyEmail,
        notifyPush: dto.notifyPush,
        notifyNewsletter: dto.notifyNewsletter,
        newsletterOptInAt,
        timezone: dto.timezone,
        enabledDomains: dto.enabledDomains,
        mobileNavShortcuts: dto.mobileNavShortcuts,
        // Empty string clears the bio back to null.
        bio: dto.bio === undefined ? undefined : dto.bio || null,
        defaultReviewVisibility: dto.defaultReviewVisibility,
        defaultListVisibility: dto.defaultListVisibility,
        locale: dto.locale as string,
        hideProgression: dto.hideProgression,
      },
    });
    return toUserDto(user);
  }

  /**
   * Requires the current password, since email doubles as the login
   * identifier. Doesn't change the email yet — sends a confirmation code to
   * the new address; see confirmEmailChange().
   */
  async changeEmail(userId: string, dto: ChangeEmailDto): Promise<void> {
    const current = await this.requireVerifiedUser(userId, dto.currentPassword);

    if (dto.newEmail === current.email) {
      throw new AppException(
        HttpStatus.CONFLICT,
        ErrorCode.UserEmailAlreadyCurrent,
        undefined,
        "This is already your current email address",
      );
    }

    const existing = await this.prisma.user.findUnique({
      where: { email: dto.newEmail },
      select: { id: true },
    });

    if (existing && existing.id !== userId) {
      throw new AppException(
        HttpStatus.CONFLICT,
        ErrorCode.UserEmailAlreadyExists,
        undefined,
        "An account with this email already exists",
      );
    }

    const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
    await this.prisma.$transaction([
      this.prisma.emailChangeRequest.deleteMany({ where: { userId } }),
      this.prisma.emailChangeRequest.create({
        data: {
          userId,
          newEmail: dto.newEmail,
          codeHash: hashToken(code),
          expiresAt: new Date(Date.now() + EMAIL_CHANGE_TTL_MINUTES * 60_000),
        },
      }),
    ]);
    await this.mail.sendEmailChangeCode(
      { email: dto.newEmail, locale: current.locale },
      code,
    );
  }

  /** Consumes the code sent by changeEmail() and applies the new address. */
  async confirmEmailChange(
    userId: string,
    dto: ConfirmEmailChangeDto,
    userAgent?: string,
  ): Promise<UserDto> {
    const current = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!current) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.UserAccountNotFound,
        undefined,
        "User not found",
      );
    }

    const stored = await this.prisma.emailChangeRequest.findFirst({
      where: { userId },
    });

    const matches =
      stored &&
      stored.codeHash === hashToken(dto.code) &&
      stored.expiresAt >= new Date();

    if (!stored || !matches) {
      if (stored) {
        if (stored.attempts + 1 >= MAX_EMAIL_CHANGE_ATTEMPTS) {
          await this.prisma.emailChangeRequest.deleteMany({
            where: { userId },
          });
        } else {
          await this.prisma.emailChangeRequest.update({
            where: { id: stored.id },
            data: { attempts: { increment: 1 } },
          });
        }
      }

      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        ErrorCode.UserEmailChangeCodeInvalid,
        undefined,
        "Invalid or expired code",
      );
    }

    const [user] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { email: stored.newEmail },
      }),
      this.prisma.emailChangeRequest.deleteMany({ where: { userId } }),
    ]);
    await this.mail.sendEmailChanged(
      current.email,
      stored.newEmail,
      current.locale,
    );
    await this.security.record({
      type: "EMAIL_CHANGED",
      userId,
      detail: `${current.email} → ${stored.newEmail}`,
      userAgent,
    });
    return toUserDto(user);
  }

  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
    userAgent?: string,
  ): Promise<void> {
    const current = await this.requireVerifiedUser(userId, dto.currentPassword);

    if (await bcrypt.compare(dto.newPassword, current.passwordHash)) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.UserPasswordSameAsCurrent,
        undefined,
        "New password must be different from the current password",
      );
    }

    if (await this.hibp.isPasswordPwned(dto.newPassword)) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.AuthPasswordBreached,
        undefined,
        "This password has appeared in a known data breach — please choose a different one",
      );
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          passwordHash: await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS),
        },
      }),
      this.prisma.refreshToken.deleteMany({ where: { userId } }),
    ]);
    await this.mail.sendPasswordChanged({
      email: current.email,
      locale: current.locale,
    });
    await this.security.record({
      type: "PASSWORD_CHANGED",
      userId,
      userAgent,
    });
  }

  /**
   * Live preview of what deleting the account would do, for the confirmation
   * modal — every category is always present, even at 0 rows, so the summary
   * reads as exhaustive. Mirrors the `onDelete` behaviour in schema.prisma:
   * most owned rows cascade away, Review/Comment/Report are detached
   * (SetNull) instead since their content is visible to other users.
   */
  async deletionSummary(userId: string): Promise<AccountDeletionSummaryDto> {
    const [
      library,
      watchHistory,
      games,
      books,
      music,
      lists,
      notifications,
      followers,
      following,
      blocks,
      activity,
      reviews,
      comments,
      reports,
    ] = await Promise.all([
      this.prisma.libraryEntry.count({ where: { userId } }),
      this.prisma.episodeWatch.count({ where: { userId } }),
      this.prisma.gameEntry.count({ where: { userId } }),
      this.prisma.bookEntry.count({ where: { userId } }),
      this.prisma.musicEntry.count({ where: { userId } }),
      // A list with editors isn't deleted, ownership is transferred instead
      // (see deleteAccount) — only count lists that will actually cascade.
      this.prisma.list.count({ where: { userId, members: { none: {} } } }),
      this.prisma.notification.count({ where: { userId } }),
      this.prisma.follow.count({ where: { followeeId: userId } }),
      this.prisma.follow.count({ where: { followerId: userId } }),
      this.prisma.block.count({
        where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
      }),
      this.prisma.activityEvent.count({ where: { userId } }),
      this.prisma.review.count({ where: { userId } }),
      this.prisma.comment.count({ where: { authorId: userId } }),
      this.prisma.report.count({ where: { reporterId: userId } }),
    ]);

    return {
      deleted: [
        { category: "LIBRARY", count: library },
        { category: "WATCH_HISTORY", count: watchHistory },
        { category: "GAMES", count: games },
        { category: "BOOKS", count: books },
        { category: "MUSIC", count: music },
        { category: "LISTS", count: lists },
        { category: "NOTIFICATIONS", count: notifications },
        { category: "FOLLOWS", count: followers + following },
        { category: "BLOCKS", count: blocks },
        { category: "ACTIVITY", count: activity },
      ],
      anonymized: [
        { category: "REVIEWS", count: reviews },
        { category: "COMMENTS", count: comments },
        { category: "REPORTS", count: reports },
      ],
    };
  }

  /**
   * Permanently deletes the account. The current password is re-confirmed since
   * this is irreversible. All owned rows (library entries, watches, refresh
   * tokens, notifications) go with it via `onDelete: Cascade`; Review/Comment/
   * Report are detached (SetNull) instead of deleted — see deletionSummary()
   * above — and the shared MediaItem cache is untouched. A list with editors
   * is the one exception to the cascade: ownership passes to the earliest
   * editor first (see ListService.reassignOwnedListsOnAccountDeletion), so
   * shared work doesn't vanish because one collaborator left.
   */
  async deleteAccount(
    userId: string,
    dto: DeleteAccountDto,
    userAgent?: string,
  ): Promise<void> {
    await this.requireVerifiedUser(userId, dto.currentPassword);

    await this.accountDeletion.deleteAccount(
      userId,
      "Suppression demandée par l'utilisateur",
      userAgent,
    );
  }

  /** Live check backing the debounced availability hint in the username form. */
  async checkUsernameAvailability(
    userId: string,
    value?: string,
  ): Promise<UsernameAvailabilityDto> {
    if (!value) {
      return { available: false };
    }

    const existing = await this.prisma.user.findUnique({
      where: { username: value },
      select: { id: true },
    });
    return { available: !existing || existing.id === userId };
  }

  /** Re-validates uniqueness server-side — the debounced check is a hint, not the source of truth. */
  async updateUsername(
    userId: string,
    dto: UpdateUsernameDto,
  ): Promise<UserDto> {
    const existing = await this.prisma.user.findUnique({
      where: { username: dto.username },
      select: { id: true },
    });

    if (existing && existing.id !== userId) {
      throw new AppException(
        HttpStatus.CONFLICT,
        ErrorCode.UserUsernameTaken,
        undefined,
        "This username is already taken",
      );
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { username: dto.username },
    });
    return toUserDto(user);
  }

  /**
   * Loads the account and re-confirms its password — the shared guard for the
   * sensitive self-service actions (email/password change, deletion), where
   * the current password is required since email doubles as the login id.
   */
  private async requireVerifiedUser(
    userId: string,
    currentPassword: string,
  ): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.UserAccountNotFound,
        undefined,
        "User not found",
      );
    }

    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        ErrorCode.AuthCurrentPasswordIncorrect,
        undefined,
        "Current password is incorrect",
      );
    }

    return user;
  }
}
