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
import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiCreatedResponse, ApiOkResponse } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { User } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import type { FastifyReply } from "fastify";
import { randomBytes, randomInt } from "node:crypto";
import { BCRYPT_ROUNDS, hashToken, toUserDto } from "../auth/auth.service";
import type { JwtPayload } from "../auth/decorators/current-user.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Public } from "../auth/decorators/public.decorator";
import { AppException } from "../common/app.exception";
import { HibpService } from "../common/hibp.service";
import { parseEnumParam } from "../common/parse-enum-param.util";
import { EntitlementService } from "../entitlements/entitlement.service";
import { MailService } from "../mail/mail.service";
import { PrismaService } from "../prisma/prisma.service";
import { SecurityEventService } from "../security/security-event.service";
import { SocialProfileResponseDto } from "../social/dto/social-profile-response.dto";
import { ProfileService } from "../social/profile.service";
import { AccountDeletionService } from "./account-deletion.service";
import { isAdult } from "./age.util";
import { matchesMimeType } from "./avatar.util";
import { CsvExportService } from "./csv-export.service";
import { DataExportService } from "./data-export.service";
import { AccountDeletionSummaryResponseDto } from "./dto/account-deletion-summary-response.dto";
import { CalendarTokenResponseDto } from "./dto/calendar-token-response.dto";
import { ChangeEmailDto } from "./dto/change-email.dto";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { ConfirmEmailChangeDto } from "./dto/confirm-email-change.dto";
import { CsvExportResponseDto } from "./dto/csv-export-response.dto";
import { UserDataExportResponseDto } from "./dto/data-export/user-data-export-response.dto";
import { DeleteAccountDto } from "./dto/delete-account.dto";
import { EntitlementResponseDto } from "./dto/entitlement-response.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { UpdateUsernameDto } from "./dto/update-username.dto";
import { UploadAvatarDto } from "./dto/upload-avatar.dto";
import { UserResponseDto } from "./dto/user-response.dto";
import { UsernameAvailabilityResponseDto } from "./dto/username-availability-response.dto";
import { WidgetTokenResponseDto } from "./dto/widget-token-response.dto";
import { signWidgetToken } from "./widget-token.util";

// Decoded byte ceiling for an uploaded avatar — base64 for this is checked by
// UploadAvatarDto's MaxLength, this is the belt-and-suspenders check on the
// actual decoded buffer.
const MAX_AVATAR_BYTES = 2.5 * 1024 * 1024;

const EMAIL_CHANGE_TTL_MINUTES = 15;
const MAX_EMAIL_CHANGE_ATTEMPTS = 5;

@Controller("users")
export class UsersController {
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

  @Get("me")
  @ApiOkResponse({ type: UserResponseDto })
  async getMe(@CurrentUser() payload: JwtPayload): Promise<UserDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

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
  @Get("me/profile")
  @ApiOkResponse({ type: SocialProfileResponseDto })
  async getMyProfile(
    @CurrentUser() payload: JwtPayload,
  ): Promise<SocialProfileDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { username: true },
    });

    if (!user) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.UserAccountNotFound,
      );
    }

    return this.profiles.getProfile(payload.sub, user.username);
  }

  /**
   * Signs a short-lived (5 min) SSO token for Quackback's feedback widget
   * "Verified identity only" mode — the widget trusts this signature
   * instead of asking the visitor to type in their own email. Re-signed on
   * every call rather than cached, since it always expires quickly anyway.
   */
  @Get("me/widget-token")
  @ApiOkResponse({ type: WidgetTokenResponseDto })
  async getWidgetToken(
    @CurrentUser() payload: JwtPayload,
  ): Promise<WidgetTokenDto> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: payload.sub },
      select: { displayName: true },
    });

    const ssoToken = signWidgetToken(
      {
        sub: payload.sub,
        email: payload.email,
        name: user.displayName,
        exp: Math.floor(Date.now() / 1000) + 300,
      },
      this.config.getOrThrow<string>("QUACKBACK_WIDGET_SECRET"),
    );

    return { ssoToken };
  }

  /**
   * Public (no auth) so a plain `<img src>` can load it — the SPA keeps its
   * JWT in localStorage, unreachable from an image request. Cuids are
   * unguessable enough that this doesn't leak anything the id itself doesn't.
   */
  @Public()
  @Get(":id/avatar")
  async getAvatar(
    @Param("id") id: string,
    @Res() reply: FastifyReply,
  ): Promise<void> {
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

    reply
      .header("Cache-Control", "public, max-age=31536000, immutable")
      // helmet is registered app-wide and defaults to
      // `Cross-Origin-Resource-Policy: same-origin`, which blocks this image
      // whenever the web app is served from another origin — the dev setup
      // (:5173 calling :3000) and any deployment where the API is on its own
      // host. Firefox reports it as NS_ERROR_DOM_CORP_FAILED. Relaxed here
      // only: an avatar is a public image, unlike every JSON response.
      .header("Cross-Origin-Resource-Policy", "cross-origin")
      .type(user.avatarMimeType)
      .send(user.avatar);
  }

  /** Replaces the account's profile picture. */
  @Patch("me/avatar")
  @ApiOkResponse({ type: UserResponseDto })
  async uploadAvatar(
    @CurrentUser() payload: JwtPayload,
    @Body() dto: UploadAvatarDto,
  ): Promise<UserDto> {
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
      where: { id: payload.sub },
      data: {
        avatar: buffer,
        avatarMimeType: dto.mimeType,
        avatarUpdatedAt: new Date(),
      },
    });
    return toUserDto(user);
  }

  /** Clears the profile picture — the client falls back to the identicon. */
  @Delete("me/avatar")
  @ApiOkResponse({ type: UserResponseDto })
  async deleteAvatar(@CurrentUser() payload: JwtPayload): Promise<UserDto> {
    const user = await this.prisma.user.update({
      where: { id: payload.sub },
      data: { avatar: null, avatarMimeType: null, avatarUpdatedAt: null },
    });
    return toUserDto(user);
  }

  /** Full portable dump of the account's data (GDPR "download my data"). */
  @Get("me/export")
  @ApiOkResponse({ type: UserDataExportResponseDto })
  exportData(@CurrentUser() payload: JwtPayload): Promise<UserDataExportDto> {
    return this.dataExport.buildExport(payload.sub);
  }

  /**
   * Flat per-domain CSV, meant for migrating to another tool rather than the
   * GDPR dump above. Deliberately not gated by `enabledDomains` — a domain the
   * user hid from their own nav is still theirs to export.
   */
  @Get("me/export.csv")
  @ApiOkResponse({ type: CsvExportResponseDto })
  async exportCsv(
    @CurrentUser() payload: JwtPayload,
    @Query("domain") domainParam: string,
  ): Promise<CsvExportDto> {
    const domain = parseEnumParam(domainParam, Object.values(Domain), "domain");
    return { csv: await this.csvExport.buildCsv(payload.sub, domain) };
  }

  /**
   * Returns the token for the user's public .ics calendar subscription URL,
   * generating one on first call. Stable across calls — use the regenerate
   * endpoint below to revoke a previously shared link. Premium
   * (docs/adr/0001-open-core-agpl.md) — see LibraryService#getCalendarIcs
   * for the matching check on the feed itself.
   */
  @Get("me/calendar-token")
  @ApiOkResponse({ type: CalendarTokenResponseDto })
  async getCalendarToken(
    @CurrentUser() payload: JwtPayload,
  ): Promise<CalendarTokenDto> {
    await this.requirePremium(payload.sub);

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: payload.sub },
      select: { calendarToken: true },
    });

    if (user.calendarToken) {
      return { token: user.calendarToken };
    }

    const { calendarToken } = await this.prisma.user.update({
      where: { id: payload.sub },
      data: { calendarToken: randomBytes(24).toString("base64url") },
      select: { calendarToken: true },
    });
    return { token: calendarToken! };
  }

  /** Issues a new token, invalidating any previously shared .ics link. Premium. */
  @Post("me/calendar-token/regenerate")
  @ApiCreatedResponse({ type: CalendarTokenResponseDto })
  async regenerateCalendarToken(
    @CurrentUser() payload: JwtPayload,
  ): Promise<CalendarTokenDto> {
    await this.requirePremium(payload.sub);

    const { calendarToken } = await this.prisma.user.update({
      where: { id: payload.sub },
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
  @Get("me/entitlement")
  @ApiOkResponse({ type: EntitlementResponseDto })
  async getMyEntitlement(
    @CurrentUser() payload: JwtPayload,
  ): Promise<EntitlementDto> {
    return { isPremium: await this.entitlements.hasPremium(payload.sub) };
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
  @Post("me/complete-onboarding")
  @ApiCreatedResponse({ type: UserResponseDto })
  async completeOnboarding(
    @CurrentUser() payload: JwtPayload,
  ): Promise<UserDto> {
    const user = await this.prisma.user.update({
      where: { id: payload.sub },
      data: { onboardedAt: new Date() },
    });
    return toUserDto(user);
  }

  /**
   * Records re-acceptance of the current CGU (LK-C03) — the blocking
   * app/+layout.svelte prompt shown when acceptedTermsVersion no longer
   * matches LEGAL_VERSION.
   */
  @Post("me/accept-terms")
  @ApiCreatedResponse({ type: UserResponseDto })
  async acceptTerms(@CurrentUser() payload: JwtPayload): Promise<UserDto> {
    const user = await this.prisma.user.update({
      where: { id: payload.sub },
      data: {
        acceptedTermsAt: new Date(),
        acceptedTermsVersion: LEGAL_VERSION,
      },
    });
    return toUserDto(user);
  }

  @Patch("me")
  @ApiOkResponse({ type: UserResponseDto })
  async updateMe(
    @CurrentUser() payload: JwtPayload,
    @Body() dto: UpdateUserDto,
  ): Promise<UserDto> {
    if (dto.birthDate && new Date(dto.birthDate) > new Date()) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.UserBirthDateFuture,
        undefined,
        "Birth date cannot be in the future",
      );
    }

    const current = await this.prisma.user.findUnique({
      where: { id: payload.sub },
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
      where: { id: payload.sub },
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
  // Every call bcrypt.compare()s the current password (requireVerifiedUser)
  // — the global 60/min default let a stolen access token burn 60 bcrypt
  // hashes/min against it (LK-S10).
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Patch("me/email")
  async changeEmail(
    @CurrentUser() payload: JwtPayload,
    @Body() dto: ChangeEmailDto,
  ): Promise<void> {
    const current = await this.requireVerifiedUser(
      payload.sub,
      dto.currentPassword,
    );

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

    if (existing && existing.id !== payload.sub) {
      throw new AppException(
        HttpStatus.CONFLICT,
        ErrorCode.UserEmailAlreadyExists,
        undefined,
        "An account with this email already exists",
      );
    }

    const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
    await this.prisma.$transaction([
      this.prisma.emailChangeRequest.deleteMany({
        where: { userId: payload.sub },
      }),
      this.prisma.emailChangeRequest.create({
        data: {
          userId: payload.sub,
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
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Patch("me/email/confirm")
  @ApiOkResponse({ type: UserResponseDto })
  async confirmEmailChange(
    @CurrentUser() payload: JwtPayload,
    @Body() dto: ConfirmEmailChangeDto,
    @Headers("user-agent") userAgent?: string,
  ): Promise<UserDto> {
    const current = await this.prisma.user.findUnique({
      where: { id: payload.sub },
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
      where: { userId: payload.sub },
    });

    const matches =
      stored &&
      stored.codeHash === hashToken(dto.code) &&
      stored.expiresAt >= new Date();

    if (!stored || !matches) {
      if (stored) {
        if (stored.attempts + 1 >= MAX_EMAIL_CHANGE_ATTEMPTS) {
          await this.prisma.emailChangeRequest.deleteMany({
            where: { userId: payload.sub },
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
        where: { id: payload.sub },
        data: { email: stored.newEmail },
      }),
      this.prisma.emailChangeRequest.deleteMany({
        where: { userId: payload.sub },
      }),
    ]);
    await this.mail.sendEmailChanged(
      current.email,
      stored.newEmail,
      current.locale,
    );
    await this.security.record({
      type: "EMAIL_CHANGED",
      userId: payload.sub,
      detail: `${current.email} → ${stored.newEmail}`,
      userAgent,
    });
    return toUserDto(user);
  }

  // Same reasoning as changeEmail() above — bcrypt.compare() on every call.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Patch("me/password")
  async changePassword(
    @CurrentUser() payload: JwtPayload,
    @Body() dto: ChangePasswordDto,
    @Headers("user-agent") userAgent?: string,
  ): Promise<void> {
    const current = await this.requireVerifiedUser(
      payload.sub,
      dto.currentPassword,
    );

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
        where: { id: payload.sub },
        data: {
          passwordHash: await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS),
        },
      }),
      this.prisma.refreshToken.deleteMany({ where: { userId: payload.sub } }),
    ]);
    await this.mail.sendPasswordChanged({
      email: current.email,
      locale: current.locale,
    });
    await this.security.record({
      type: "PASSWORD_CHANGED",
      userId: payload.sub,
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
  @Get("me/deletion-summary")
  @ApiOkResponse({ type: AccountDeletionSummaryResponseDto })
  async deletionSummary(
    @CurrentUser() payload: JwtPayload,
  ): Promise<AccountDeletionSummaryDto> {
    const userId = payload.sub;
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
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete("me")
  async deleteAccount(
    @CurrentUser() payload: JwtPayload,
    @Body() dto: DeleteAccountDto,
    @Headers("user-agent") userAgent?: string,
  ): Promise<void> {
    await this.requireVerifiedUser(payload.sub, dto.currentPassword);

    await this.accountDeletion.deleteAccount(
      payload.sub,
      "Suppression demandée par l'utilisateur",
      userAgent,
    );
  }

  /** Live check backing the debounced availability hint in the username form. */
  @Get("me/username-availability")
  @ApiOkResponse({ type: UsernameAvailabilityResponseDto })
  async checkUsernameAvailability(
    @CurrentUser() payload: JwtPayload,
    @Query("value") value?: string,
  ): Promise<UsernameAvailabilityDto> {
    if (!value) {
      return { available: false };
    }

    const existing = await this.prisma.user.findUnique({
      where: { username: value },
      select: { id: true },
    });
    return { available: !existing || existing.id === payload.sub };
  }

  /** Re-validates uniqueness server-side — the debounced check is a hint, not the source of truth. */
  @Patch("me/username")
  @ApiOkResponse({ type: UserResponseDto })
  async updateUsername(
    @CurrentUser() payload: JwtPayload,
    @Body() dto: UpdateUsernameDto,
  ): Promise<UserDto> {
    const existing = await this.prisma.user.findUnique({
      where: { username: dto.username },
      select: { id: true },
    });

    if (existing && existing.id !== payload.sub) {
      throw new AppException(
        HttpStatus.CONFLICT,
        ErrorCode.UserUsernameTaken,
        undefined,
        "This username is already taken",
      );
    }

    const user = await this.prisma.user.update({
      where: { id: payload.sub },
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
