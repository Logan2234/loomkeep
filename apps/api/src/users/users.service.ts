import {
  Domain,
  ErrorCode,
  HOME_GRID_COLUMNS,
  LEGAL_VERSION,
  mergeAlertPrefs,
  UserDto,
  UsernameAvailabilityDto,
  XpReason,
  type AccountDeletionSummaryDto,
  type AlertPrefs,
  type CsvExportDto,
  type EntitlementDto,
  type SocialProfileDto,
  type UserDataExportDto,
  type WidgetTokenDto,
} from "@loomkeep/shared";
import { HttpStatus, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma, type User } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";
import { ApiKeysService } from "../api-keys/api-keys.service";
import { BCRYPT_ROUNDS, toUserDto } from "../auth/auth.service";
import { AppException } from "../common/app.exception";
import { sha256Hex } from "../common/crypto.util";
import { HibpService } from "../common/hibp.service";
import { parseEnumParam } from "../common/parse-enum-param.util";
import { EntitlementService } from "../entitlements/entitlement.service";
import { EventsGateway } from "../events/events.gateway";
import { XpService } from "../gamification/xp.service";
import { MailService } from "../mail/mail.service";
import { PrismaService } from "../prisma/prisma.service";
import { SecurityEventService } from "../security/security-event.service";
import { ProfileService } from "../social/profile.service";
import { AccountDeletionService } from "./account-deletion.service";
import { isAdult } from "./age.util";
import {
  matchesMimeType,
  reencodeAvatar,
  STORED_AVATAR_MIME_TYPE,
} from "./avatar.util";
import { CsvExportService } from "./csv-export.service";
import { DataExportService } from "./data-export.service";
import type { ChangeEmailDto } from "./dto/change-email.dto";
import type { ChangePasswordDto } from "./dto/change-password.dto";
import type { ConfirmEmailChangeDto } from "./dto/confirm-email-change.dto";
import type { DeleteAccountDto } from "./dto/delete-account.dto";
import type { HomeLayoutBody } from "./dto/home-layout.dto";
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
    private readonly xp: XpService,
    private readonly events: EventsGateway,
    private readonly apiKeys: ApiKeysService,
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

    // Kept above as a cheap, precise rejection; the re-encode below is what
    // actually guarantees what lands in the database (see reencodeAvatar).
    let encoded: Uint8Array<ArrayBuffer>;

    try {
      encoded = await reencodeAvatar(buffer);
    } catch {
      // Magic bytes matched but the decoder refused it: truncated, corrupt,
      // or a header glued onto something else.
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.UserAvatarInvalidType,
        undefined,
        "Image could not be decoded",
      );
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        avatar: encoded,
        avatarMimeType: STORED_AVATAR_MIME_TYPE,
        avatarUpdatedAt: new Date(),
      },
    });
    await this.maybeAwardProfileCompleted(userId, user);
    return toUserDto(user);
  }

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
   * The user's real plan (not gated by `premium-features` — see
   * `EntitlementService#isEffectivelyPremium`) so the web can decide what to
   * lock: `showLock = flag on && !isPremium`.
   */
  async getMyEntitlement(userId: string): Promise<EntitlementDto> {
    return { isPremium: await this.entitlements.hasPremium(userId) };
  }

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

  /**
   * Stores the home grid as sent, only pulled back inside the grid: a widget
   * overflowing the right edge slides left, and a repeated id keeps its first
   * widget. Overlaps are left alone — the web compacts on every render.
   */
  async setHomeLayout(userId: string, body: HomeLayoutBody): Promise<UserDto> {
    const seen = new Set<string>();
    const widgets = body.widgets
      .filter((widget) => {
        if (seen.has(widget.id)) return false;
        seen.add(widget.id);
        return true;
      })
      .map((widget) => ({
        ...widget,
        x: Math.min(widget.x, HOME_GRID_COLUMNS - widget.w),
      }));
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { homeLayout: { widgets } as unknown as Prisma.InputJsonValue },
    });
    return toUserDto(user);
  }

  /** Back to the default grid, which follows the enabled domains again. */
  async resetHomeLayout(userId: string): Promise<UserDto> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { homeLayout: Prisma.DbNull },
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
        alertPrefs: true,
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

    const alertPrefs = dto.alertPrefs
      ? mergeAlertPrefs(current.alertPrefs as AlertPrefs, dto.alertPrefs)
      : undefined;

    if (alertPrefs === null) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.ValidationFailed,
        undefined,
        "alertPrefs names an alert or channel that has no setting",
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
        alertPrefs,
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
        spoilerSensitivity: dto.spoilerSensitivity,
        domainOrder: dto.domainOrder,
        watchRegion: dto.watchRegion,
        watchProviderIds: dto.watchProviderIds,
      },
    });
    await this.maybeAwardProfileCompleted(userId, user);
    return toUserDto(user);
  }

  /**
   * Credits `PROFILE_COMPLETED` once both a bio and an avatar are set —
   * called after every update to either. `XpService.award` is already
   * idempotent (it swallows the unique-constraint error on a repeat), so
   * this doesn't need to check beforehand whether it already fired.
   */
  private async maybeAwardProfileCompleted(
    userId: string,
    user: Pick<User, "avatar" | "bio">,
  ): Promise<void> {
    if (user.avatar && user.bio?.trim()) {
      await this.xp.award(userId, XpReason.PROFILE_COMPLETED, userId);
      // complete_profile is one of the onboarding checklist's steps
      // (OnboardingService) — this method's own condition is exactly that
      // step's own check.
      this.events.emitToUser(userId, "onboarding-updated");
    }
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
          codeHash: sha256Hex(code),
          expiresAt: new Date(Date.now() + EMAIL_CHANGE_TTL_MINUTES * 60_000),
        },
      }),
    ]);
    await this.mail.sendEmailChangeCode(
      { email: dto.newEmail, locale: current.locale },
      code,
    );
  }

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
      stored.codeHash === sha256Hex(dto.code) &&
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
    const occurredAt = await this.security.record({
      type: "EMAIL_CHANGED",
      userId,
      detail: `${current.email} → ${stored.newEmail}`,
      userAgent,
    });
    await this.mail.sendEmailChanged(
      current.email,
      stored.newEmail,
      current.locale,
      occurredAt,
    );
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
    const occurredAt = await this.security.record({
      type: "PASSWORD_CHANGED",
      userId,
      userAgent,
    });
    await this.mail.sendPasswordChanged(
      { email: current.email, locale: current.locale },
      await this.apiKeys.reviewAfterPasswordChange(userId),
      occurredAt,
    );
  }

  /**
   * Live preview of what deleting the account would do, for the confirmation
   * modal — every category is always present, even at 0 rows, so the summary
   * reads as exhaustive. Mirrors the `onDelete` behaviour in schema.prisma and
   * AccountDeletionService: owned rows cascade away; what other members can
   * see (reviews, comments, items added to their lists) is detached
   * (SetNull) instead; lists with editors change hands.
   */
  async deletionSummary(userId: string): Promise<AccountDeletionSummaryDto> {
    const own = { userId };
    const [
      sessions,
      user,
      library,
      episodeWatches,
      movieRewatches,
      games,
      gamePlaythroughs,
      gameSessions,
      books,
      bookReadings,
      bookSessions,
      readingGoals,
      sessionTimers,
      music,
      soloLists,
      listMemberships,
      listMutes,
      follows,
      blocks,
      reviewVotes,
      commentReactions,
      notifications,
      activity,
      achievements,
      savedViews,
      visibilitySettings,
      devices,
      apiKeys,
      passkeys,
      recoveryCodes,
      pushSubscriptions,
      emailChanges,
      emailedLinks,
      premiumPlans,
      subscriptions,
      reviews,
      reviewRevisions,
      comments,
      listItemsAdded,
      reports,
      imports,
      securityEvents,
      moderationDecisions,
      removedContentCopies,
      sharedLists,
    ] = await Promise.all([
      this.prisma.refreshToken.count({ where: own }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { mfaTotpEnabled: true, mfaEmailEnabled: true },
      }),
      this.prisma.libraryEntry.count({ where: own }),
      this.prisma.episodeWatch.count({ where: own }),
      this.prisma.movieReplay.count({ where: { libraryEntry: own } }),
      this.prisma.gameEntry.count({ where: own }),
      this.prisma.gamePlaythrough.count({ where: { gameEntry: own } }),
      this.prisma.gameSession.count({ where: { gameEntry: own } }),
      this.prisma.bookEntry.count({ where: own }),
      this.prisma.bookReading.count({ where: { bookEntry: own } }),
      this.prisma.bookSession.count({ where: { bookEntry: own } }),
      this.prisma.readingGoal.count({ where: own }),
      this.prisma.sessionTimer.count({ where: own }),
      this.prisma.musicEntry.count({ where: own }),
      this.prisma.list.count({ where: { userId, members: { none: {} } } }),
      this.prisma.listMember.count({ where: own }),
      this.prisma.listNotificationMute.count({ where: own }),
      this.prisma.follow.count({
        where: { OR: [{ followerId: userId }, { followeeId: userId }] },
      }),
      this.prisma.block.count({
        where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
      }),
      this.prisma.reviewVote.count({ where: own }),
      this.prisma.commentReaction.count({ where: own }),
      this.prisma.notification.count({ where: own }),
      this.prisma.activityEvent.count({ where: own }),
      this.prisma.userAchievement.count({ where: own }),
      this.prisma.savedView.count({ where: own }),
      this.prisma.visibilitySetting.count({ where: own }),
      this.prisma.userDevice.count({ where: own }),
      this.prisma.apiKey.count({ where: own }),
      this.prisma.webauthnCredential.count({ where: own }),
      this.prisma.mfaRecoveryCode.count({ where: own }),
      this.prisma.pushSubscription.count({ where: own }),
      this.prisma.emailChangeRequest.count({ where: own }),
      this.prisma.userToken.count({ where: own }),
      this.prisma.userEntitlement.count({
        where: { userId, plan: "PREMIUM" },
      }),
      this.prisma.subscription.count({ where: own }),
      this.prisma.review.count({ where: own }),
      this.prisma.reviewRevision.count({ where: { review: own } }),
      this.prisma.comment.count({ where: { authorId: userId } }),
      // Items in the account's own solo lists go with those lists.
      this.prisma.listItem.count({
        where: {
          addedById: userId,
          NOT: { list: { userId, members: { none: {} } } },
        },
      }),
      this.prisma.report.count({ where: { reporterId: userId } }),
      this.prisma.importRun.count({ where: own }),
      this.prisma.securityEvent.count({ where: own }),
      this.prisma.moderationDecision.count({
        where: { subjectUserId: userId },
      }),
      this.prisma.moderationDecision.count({
        where: { subjectUserId: userId, contentSnapshot: { not: null } },
      }),
      this.prisma.list.findMany({
        where: { userId, members: { some: {} } },
        orderBy: { title: "asc" },
        select: {
          title: true,
          members: {
            orderBy: { createdAt: "asc" },
            take: 1,
            select: { user: { select: { displayName: true } } },
          },
        },
      }),
    ]);

    const twoFactor =
      Number(user?.mfaTotpEnabled ?? false) +
      Number(user?.mfaEmailEnabled ?? false) +
      recoveryCodes;

    return {
      sessions,
      deleted: [
        { category: "LIBRARY", count: library },
        { category: "EPISODE_WATCHES", count: episodeWatches },
        { category: "MOVIE_REWATCHES", count: movieRewatches },
        { category: "GAMES", count: games },
        { category: "GAME_PLAYTHROUGHS", count: gamePlaythroughs },
        { category: "GAME_SESSIONS", count: gameSessions },
        { category: "BOOKS", count: books },
        { category: "BOOK_READINGS", count: bookReadings },
        { category: "BOOK_SESSIONS", count: bookSessions },
        { category: "READING_GOALS", count: readingGoals },
        { category: "SESSION_TIMER", count: sessionTimers },
        { category: "MUSIC", count: music },
        { category: "LISTS", count: soloLists },
        { category: "LIST_MEMBERSHIPS", count: listMemberships },
        { category: "LIST_MUTES", count: listMutes },
        { category: "FOLLOWS", count: follows },
        { category: "BLOCKS", count: blocks },
        { category: "REACTIONS", count: reviewVotes + commentReactions },
        { category: "NOTIFICATIONS", count: notifications },
        { category: "ACTIVITY", count: activity },
        { category: "PROGRESSION", count: achievements },
        { category: "SAVED_VIEWS", count: savedViews },
        { category: "VISIBILITY_SETTINGS", count: visibilitySettings },
        { category: "DEVICES", count: devices },
        { category: "API_KEYS", count: apiKeys },
        { category: "PASSKEYS", count: passkeys },
        { category: "TWO_FACTOR", count: twoFactor },
        { category: "PUSH_SUBSCRIPTIONS", count: pushSubscriptions },
        { category: "PENDING_REQUESTS", count: emailChanges + emailedLinks },
        { category: "PREMIUM", count: premiumPlans + subscriptions },
      ],
      anonymized: [
        { category: "REVIEWS", count: reviews },
        { category: "REVIEW_REVISIONS", count: reviewRevisions },
        { category: "COMMENTS", count: comments },
        { category: "LIST_ITEMS_ADDED", count: listItemsAdded },
        { category: "REPORTS", count: reports },
        { category: "IMPORTS", count: imports },
      ],
      transferredLists: sharedLists.map((list) => ({
        title: list.title,
        newOwner: list.members[0].user.displayName,
      })),
      kept: [
        { category: "SECURITY_EVENTS", count: securityEvents },
        { category: "MODERATION_DECISIONS", count: moderationDecisions },
        { category: "REMOVED_CONTENT_COPIES", count: removedContentCopies },
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
      "self",
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
