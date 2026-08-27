import type {
  AdminUserCommentDto,
  AdminUserFilter,
  AdminUserLibraryStatsDto,
  AdminUserListResponseDto,
  AdminUserOptionDto,
  AdminUserPlanDto,
  AdminUserRoleDto,
  MyListDto,
  MyReviewDto,
  ReportDto,
  SessionDto,
  UserDataExportDto,
  UserSummaryDto,
} from "@loomkeep/shared";
import {
  ErrorCode,
  ModerationMeasure,
  ReportTargetType,
} from "@loomkeep/shared";
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { AuthService } from "../auth/auth.service";
import type { JwtPayload } from "../auth/decorators/current-user.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { CommentService } from "../comments/comment.service";
import { AppException } from "../common/app.exception";
import { EntitlementService } from "../entitlements/entitlement.service";
import { ListService } from "../lists/list.service";
import { PrismaService } from "../prisma/prisma.service";
import { ModerationReasonBody } from "../reports/dto/moderation-reason.dto";
import { ModerationDecisionService } from "../reports/moderation-decision.service";
import { ReportService } from "../reports/report.service";
import { ReviewService } from "../reviews/review.service";
import { SecurityEventService } from "../security/security-event.service";
import { FollowService } from "../social/follow.service";
import { avatarUrl } from "../users/avatar.util";
import { DataExportService } from "../users/data-export.service";
import { AdminOnly } from "./admin-only.decorator";
import { UpdateAdminUserPlanDto } from "./dto/update-admin-user-plan.dto";
import { UpdateAdminUserRoleDto } from "./dto/update-admin-user-role.dto";

const PAGE_SIZE = 50;
const FILTERS: AdminUserFilter[] = ["all", "admin", "unverified", "never"];

/** Account administration: listing, role, data export and sessions. */
@AdminOnly()
@Controller("admin")
export class AdminUsersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly dataExport: DataExportService,
    private readonly securityEvents: SecurityEventService,
    private readonly reviews: ReviewService,
    private readonly comments: CommentService,
    private readonly follows: FollowService,
    private readonly reports: ReportService,
    private readonly lists: ListService,
    private readonly moderationDecisions: ModerationDecisionService,
    private readonly entitlements: EntitlementService,
  ) {}

  /**
   * Registered accounts, most recently created first — filterable by free-text
   * search (email/username/displayName) and by role/verification/activity, paginated.
   */
  @Get("users")
  async listUsers(
    @Query("search") search?: string,
    @Query("filter") filter?: string,
    @Query("page") page?: string,
  ): Promise<AdminUserListResponseDto> {
    const pageNum = page ? Math.max(1, Number(page)) : 1;
    const q = search?.trim();
    const activeFilter = FILTERS.includes(filter as AdminUserFilter)
      ? (filter as AdminUserFilter)
      : "all";

    const where = {
      ...(q
        ? {
            OR: [
              { email: { contains: q, mode: "insensitive" as const } },
              { username: { contains: q, mode: "insensitive" as const } },
              { displayName: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
      ...(activeFilter === "admin" ? { role: "ADMIN" as const } : {}),
      ...(activeFilter === "unverified" ? { emailVerified: false } : {}),
      ...(activeFilter === "never" ? { lastActiveAt: null } : {}),
    };

    const users = await this.prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (pageNum - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    });

    // Same batched pattern — most accounts have no row yet (defaults to
    // FREE, see EntitlementService), so this is a lookup, not a per-user query.
    const entitlements = await this.prisma.userEntitlement.findMany({
      where: { userId: { in: users.map((u) => u.id) } },
      select: { userId: true, plan: true },
    });
    const planByUserId = new Map(entitlements.map((e) => [e.userId, e.plan]));

    return {
      page: pageNum,
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        username: u.username,
        displayName: u.displayName,
        avatarUrl: avatarUrl(u),
        emailVerified: u.emailVerified,
        role: u.role,
        plan: planByUserId.get(u.id) ?? "FREE",
        createdAt: u.createdAt.toISOString(),
        lastActiveAt: u.lastActiveAt?.toISOString() ?? null,
        inactivityWarningSentAt:
          u.inactivityWarningSentAt?.toISOString() ?? null,
      })),
    };
  }

  /**
   * Minimal, unpaginated account list for pickers (UserSelector, the
   * communications broadcast target) — distinct from the paginated `users`
   * endpoint above, which now only returns one page at a time.
   */
  @Get("users/options")
  async listUserOptions(): Promise<AdminUserOptionDto[]> {
    const users = await this.prisma.user.findMany({
      orderBy: { displayName: "asc" },
      select: { id: true, displayName: true, email: true },
    });
    return users;
  }

  /**
   * Sets the target account's role. Guarded against the one lockout risk
   * that matters here: an admin demoting themselves, which would strand them
   * outside the panel (the ADMIN_EMAIL bootstrap would eventually re-promote
   * them on next login, but not before).
   */
  @Patch("users/:userId/role")
  async updateUserRole(
    @Param("userId") userId: string,
    @Body() dto: UpdateAdminUserRoleDto,
    @CurrentUser() admin: JwtPayload,
  ): Promise<AdminUserRoleDto> {
    if (userId === admin.sub && dto.role !== "ADMIN") {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.AdminCannotSelfDemote,
        undefined,
        "Cannot remove your own admin access",
      );
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { role: dto.role },
    });
    return { role: user.role };
  }

  /**
   * Sets the target account's plan (docs/adr/0001-open-core-agpl.md) — the
   * only way to grant premium today, no billing wired up yet. Recorded with
   * source ADMIN_GRANT (see EntitlementService#setPlan).
   */
  @Patch("users/:userId/plan")
  async updateUserPlan(
    @Param("userId") userId: string,
    @Body() dto: UpdateAdminUserPlanDto,
  ): Promise<AdminUserPlanDto> {
    const entitlement = await this.entitlements.setPlan(userId, dto.plan);
    return { plan: entitlement.plan };
  }

  /** Full portable dump of one account's data (GDPR "download my data"), admin-triggered. */
  @Get("users/:userId/export")
  getUserExport(@Param("userId") userId: string): Promise<UserDataExportDto> {
    return this.dataExport.buildExport(userId);
  }

  /** Reviews the account has written, with resolved targets. */
  @Get("users/:userId/reviews")
  getUserReviews(@Param("userId") userId: string): Promise<MyReviewDto[]> {
    return this.reviews.listMine(userId);
  }

  /** Comments the account has authored (excluding deleted). */
  @Get("users/:userId/comments")
  getUserComments(
    @Param("userId") userId: string,
  ): Promise<AdminUserCommentDto[]> {
    return this.comments.listByAuthor(userId);
  }

  /** Accepted followers of the account. Bypasses visibility — admin-only view. */
  @Get("users/:userId/followers")
  getUserFollowers(@Param("userId") userId: string): Promise<UserSummaryDto[]> {
    return this.follows.listFollowers(userId);
  }

  /** Accounts this user follows (accepted). Bypasses visibility — admin-only view. */
  @Get("users/:userId/following")
  getUserFollowing(@Param("userId") userId: string): Promise<UserSummaryDto[]> {
    return this.follows.listFollowing(userId);
  }

  /** Reports filed against this account, directly or against a comment they authored. */
  @Get("users/:userId/reports-against")
  getUserReportsAgainst(@Param("userId") userId: string): Promise<ReportDto[]> {
    return this.reports.listAgainstUser(userId);
  }

  /**
   * Every list the account can access — owned or granted via ListMember —
   * regardless of visibility (admin view). `role` on each row tells owned
   * apart from invited-as-editor.
   */
  @Get("users/:userId/lists")
  getUserLists(@Param("userId") userId: string): Promise<MyListDto[]> {
    return this.lists.listEditable(userId);
  }

  /** Compact library breakdown for the account drawer. */
  @Get("users/:userId/library-stats")
  async getUserLibraryStats(
    @Param("userId") userId: string,
  ): Promise<AdminUserLibraryStatsDto> {
    const [movies, series, anime, games, books, music] = await Promise.all([
      this.prisma.libraryEntry.count({
        where: { userId, mediaItem: { type: "MOVIE" } },
      }),
      this.prisma.libraryEntry.count({
        where: { userId, mediaItem: { type: "SERIES" } },
      }),
      this.prisma.libraryEntry.count({
        where: { userId, mediaItem: { type: "ANIME" } },
      }),
      this.prisma.gameEntry.count({ where: { userId } }),
      this.prisma.bookEntry.count({ where: { userId } }),
      this.prisma.musicEntry.count({ where: { userId } }),
    ]);

    return {
      movies,
      series,
      anime,
      games,
      books,
      music,
      total: movies + series + anime + games + books + music,
    };
  }

  /** Signed-in devices for one account, most recently active first. */
  @Get("users/:userId/sessions")
  listUserSessions(@Param("userId") userId: string): Promise<SessionDto[]> {
    return this.authService.listSessions(userId);
  }

  /** Revokes one device for an account (forced logout). */
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete("users/:userId/sessions/:sessionId")
  async revokeUserSession(
    @Param("userId") userId: string,
    @Param("sessionId") sessionId: string,
  ): Promise<void> {
    await this.authService.revokeSession(userId, sessionId);
  }

  /** Revokes every device for an account in one go (forced logout everywhere). */
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete("users/:userId/sessions")
  async revokeAllUserSessions(@Param("userId") userId: string): Promise<void> {
    await this.authService.revokeAllSessions(userId);
  }

  /** Re-sends the account's email-verification link. No-op target: already-verified accounts 400. */
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post("users/:userId/resend-verification")
  async resendVerification(@Param("userId") userId: string): Promise<void> {
    await this.authService.resendVerificationEmail(userId);
  }

  /** Sends the account a password-reset link, same flow as "forgot password". */
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post("users/:userId/reset-password-link")
  async sendPasswordResetLink(@Param("userId") userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    if (!user) {
      throw new AppException(HttpStatus.NOT_FOUND, ErrorCode.AdminUserNotFound);
    }

    await this.authService.requestPasswordReset(user.email);
  }

  /**
   * Permanently deletes an account and all its data. An admin can't delete
   * their own account this way (no lockout escape hatch) — self-deletion
   * stays on the password-confirmed /settings flow. Sends the DSA art. 17
   * notice (email only — there's no account left for an in-app one) before
   * the row is gone.
   */
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete("users/:userId")
  async deleteUser(
    @Param("userId") userId: string,
    @CurrentUser() admin: JwtPayload,
    @Body() body: ModerationReasonBody,
  ): Promise<void> {
    if (userId === admin.sub) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.AdminCannotSelfDelete,
        undefined,
        "Use the /settings account-deletion flow for your own account",
      );
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new AppException(HttpStatus.NOT_FOUND, ErrorCode.AdminUserNotFound);
    }

    // Recorded before the delete so the FK (onDelete: SetNull) still resolves;
    // the row itself survives the account's removal — see SecurityEvent.
    await this.securityEvents.record({
      type: "USER_DELETED",
      userId: user.id,
      detail: "Supprimé depuis le panel admin",
    });

    await this.moderationDecisions.record({
      measure: ModerationMeasure.ACCOUNT_DELETED,
      targetType: ReportTargetType.USER,
      targetId: userId,
      subjectUserId: userId,
      subjectEmail: user.email,
      subjectUsername: user.username,
      legalBasis: body.legalBasis,
      reasonText: body.reasonText,
      tosClause: body.tosClause,
      decidedById: admin.sub,
    });

    await this.prisma.user.delete({ where: { id: userId } });
  }
}
