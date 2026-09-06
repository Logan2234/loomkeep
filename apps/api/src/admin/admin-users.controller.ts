import type {
  AdminUserCommentDto,
  AdminUserDto,
  AdminUserFilter,
  AdminUserLibraryStatsDto,
  AdminUserOptionDto,
  AdminUserPlanDto,
  AdminUserRoleDto,
  MyListDto,
  MyReviewDto,
  PagedResult,
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
import { ApiOkResponse } from "@nestjs/swagger";
import { AuthService } from "../auth/auth.service";
import type { JwtPayload } from "../auth/decorators/current-user.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { SessionResponseDto } from "../auth/dto/session-response.dto";
import { CommentService } from "../comments/comment.service";
import { AppException } from "../common/app.exception";
import { PagedResponseDto } from "../common/dto/paged-response.dto";
import { UserSummaryResponseDto } from "../common/dto/user-summary-response.dto";
import { parsePageQuery } from "../common/pagination.util";
import { EntitlementService } from "../entitlements/entitlement.service";
import { MyListResponseDto } from "../lists/dto/my-list-response.dto";
import { ListService } from "../lists/list.service";
import { PrismaService } from "../prisma/prisma.service";
import { ModerationReasonBody } from "../reports/dto/moderation-reason.dto";
import { ReportResponseDto } from "../reports/dto/report-response.dto";
import { ModerationDecisionService } from "../reports/moderation-decision.service";
import { ReportService } from "../reports/report.service";
import { MyReviewResponseDto } from "../reviews/dto/my-review-response.dto";
import { ReviewService } from "../reviews/review.service";
import { SecurityEventService } from "../security/security-event.service";
import { FollowService } from "../social/follow.service";
import { avatarUrl } from "../users/avatar.util";
import { DataExportService } from "../users/data-export.service";
import { UserDataExportResponseDto } from "../users/dto/data-export/user-data-export-response.dto";
import { AdminOnly } from "./admin-only.decorator";
import { AdminUserCommentResponseDto } from "./dto/admin-user-comment-response.dto";
import { AdminUserLibraryStatsResponseDto } from "./dto/admin-user-library-stats-response.dto";
import { AdminUserOptionResponseDto } from "./dto/admin-user-option-response.dto";
import { AdminUserPlanResponseDto } from "./dto/admin-user-plan-response.dto";
import { AdminUserResponseDto } from "./dto/admin-user-response.dto";
import { AdminUserRoleResponseDto } from "./dto/admin-user-role-response.dto";
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
  @ApiOkResponse({ type: PagedResponseDto(AdminUserResponseDto) })
  async listUsers(
    @Query("search") search?: string,
    @Query("filter") filter?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ): Promise<PagedResult<AdminUserDto>> {
    const {
      skip,
      take,
      limit: pageLimit,
    } = parsePageQuery(page, limit, PAGE_SIZE);
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

    const rows = await this.prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: take + 1,
    });
    const hasMore = rows.length > pageLimit;
    const users = rows.slice(0, pageLimit);

    // Same batched pattern — most accounts have no row yet (defaults to
    // FREE, see EntitlementService), so this is a lookup, not a per-user query.
    const entitlements = await this.prisma.userEntitlement.findMany({
      where: { userId: { in: users.map((u) => u.id) } },
      select: { userId: true, plan: true },
    });
    const planByUserId = new Map(entitlements.map((e) => [e.userId, e.plan]));

    return {
      hasMore,
      items: users.map((u) => ({
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
  @ApiOkResponse({ type: AdminUserOptionResponseDto, isArray: true })
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
  @ApiOkResponse({ type: AdminUserRoleResponseDto })
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
  @ApiOkResponse({ type: AdminUserPlanResponseDto })
  async updateUserPlan(
    @Param("userId") userId: string,
    @Body() dto: UpdateAdminUserPlanDto,
  ): Promise<AdminUserPlanDto> {
    const entitlement = await this.entitlements.setPlan(userId, dto.plan);
    return { plan: entitlement.plan };
  }

  /** Full portable dump of one account's data (GDPR "download my data"), admin-triggered. */
  @Get("users/:userId/export")
  @ApiOkResponse({ type: UserDataExportResponseDto })
  getUserExport(@Param("userId") userId: string): Promise<UserDataExportDto> {
    return this.dataExport.buildExport(userId);
  }

  /** Reviews the account has written, with resolved targets. */
  @Get("users/:userId/reviews")
  @ApiOkResponse({ type: MyReviewResponseDto, isArray: true })
  getUserReviews(@Param("userId") userId: string): Promise<MyReviewDto[]> {
    return this.reviews.listMine(userId);
  }

  /** Comments the account has authored (excluding deleted). */
  @Get("users/:userId/comments")
  @ApiOkResponse({ type: AdminUserCommentResponseDto, isArray: true })
  getUserComments(
    @Param("userId") userId: string,
  ): Promise<AdminUserCommentDto[]> {
    return this.comments.listByAuthor(userId);
  }

  /** Accepted followers of the account. Bypasses visibility — admin-only view. */
  @Get("users/:userId/followers")
  @ApiOkResponse({ type: UserSummaryResponseDto, isArray: true })
  getUserFollowers(@Param("userId") userId: string): Promise<UserSummaryDto[]> {
    return this.follows.listFollowers(userId);
  }

  /** Accounts this user follows (accepted). Bypasses visibility — admin-only view. */
  @Get("users/:userId/following")
  @ApiOkResponse({ type: UserSummaryResponseDto, isArray: true })
  getUserFollowing(@Param("userId") userId: string): Promise<UserSummaryDto[]> {
    return this.follows.listFollowing(userId);
  }

  /** Reports filed against this account, directly or against a comment they authored. */
  @Get("users/:userId/reports-against")
  @ApiOkResponse({ type: ReportResponseDto, isArray: true })
  getUserReportsAgainst(@Param("userId") userId: string): Promise<ReportDto[]> {
    return this.reports.listAgainstUser(userId);
  }

  /**
   * Every list the account can access — owned or granted via ListMember —
   * regardless of visibility (admin view). `role` on each row tells owned
   * apart from invited-as-editor.
   */
  @Get("users/:userId/lists")
  @ApiOkResponse({ type: MyListResponseDto, isArray: true })
  getUserLists(@Param("userId") userId: string): Promise<MyListDto[]> {
    return this.lists.listEditable(userId);
  }

  /** Compact library breakdown for the account drawer. */
  @Get("users/:userId/library-stats")
  @ApiOkResponse({ type: AdminUserLibraryStatsResponseDto })
  async getUserLibraryStats(
    @Param("userId") userId: string,
  ): Promise<AdminUserLibraryStatsDto> {
    const [movies, series, anime, games, books] = await Promise.all([
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
    ]);

    return {
      movies,
      series,
      anime,
      games,
      books,
      total: movies + series + anime + games + books,
    };
  }

  /** Signed-in devices for one account, most recently active first. */
  @Get("users/:userId/sessions")
  @ApiOkResponse({ type: SessionResponseDto, isArray: true })
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
      subjectLocale: user.locale,
      subjectUsername: user.username,
      legalBasis: body.legalBasis,
      reasonText: body.reasonText,
      tosClause: body.tosClause,
      decidedById: admin.sub,
    });

    await this.prisma.user.delete({ where: { id: userId } });
  }
}
