import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import type {
  AdminUserCommentDto,
  AdminUserFilter,
  AdminUserListResponseDto,
  AdminUserOptionDto,
  AdminUserRoleDto,
  MyListDto,
  MyReviewDto,
  ReportDto,
  SessionDto,
  UserDataExportDto,
  UserSummaryDto,
} from "@loomkeep/shared";
import { AuthService } from "../auth/auth.service";
import type { JwtPayload } from "../auth/decorators/current-user.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { CommentService } from "../comments/comment.service";
import { ListService } from "../lists/list.service";
import { PrismaService } from "../prisma/prisma.service";
import { ReportService } from "../reports/report.service";
import { ReviewService } from "../reviews/review.service";
import { SecurityEventService } from "../security/security-event.service";
import { FollowService } from "../social/follow.service";
import { DataExportService } from "../users/data-export.service";
import { AdminOnly } from "./admin-only.decorator";
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
      ...(activeFilter === "never" ? { refreshTokens: { none: {} } } : {}),
    };

    const users = await this.prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (pageNum - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    });

    // Scoped to this page's accounts only — the full-table groupBy this
    // replaced didn't scale with the account count, this does.
    const lastActive = await this.prisma.refreshToken.groupBy({
      by: ["userId"],
      where: { userId: { in: users.map((u) => u.id) } },
      _max: { lastUsedAt: true },
    });
    const lastActiveByUserId = new Map(
      lastActive.map((r) => [r.userId, r._max.lastUsedAt]),
    );

    return {
      page: pageNum,
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        username: u.username,
        displayName: u.displayName,
        emailVerified: u.emailVerified,
        role: u.role,
        createdAt: u.createdAt.toISOString(),
        lastActiveAt: lastActiveByUserId.get(u.id)?.toISOString() ?? null,
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
      throw new BadRequestException(
        "Impossible de retirer ton propre accès admin",
      );
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { role: dto.role },
    });
    return { role: user.role };
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

  /** Every list the account owns, regardless of visibility (admin view). */
  @Get("users/:userId/lists")
  getUserLists(@Param("userId") userId: string): Promise<MyListDto[]> {
    return this.lists.listMine(userId);
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
      throw new NotFoundException("User not found");
    }

    await this.authService.requestPasswordReset(user.email);
  }

  /**
   * Permanently deletes an account and all its data. An admin can't delete
   * their own account this way (no lockout escape hatch) — self-deletion
   * stays on the password-confirmed /settings flow.
   */
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete("users/:userId")
  async deleteUser(
    @Param("userId") userId: string,
    @CurrentUser() admin: JwtPayload,
  ): Promise<void> {
    if (userId === admin.sub) {
      throw new BadRequestException(
        "Utilise la suppression de compte depuis /settings pour ton propre compte",
      );
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    // Recorded before the delete so the FK (onDelete: SetNull) still resolves;
    // the row itself survives the account's removal — see SecurityEvent.
    await this.securityEvents.record({
      type: "USER_DELETED",
      userId: user.id,
      identifier: user.email,
      detail: "Supprimé depuis le panel admin",
    });
    await this.prisma.user.delete({ where: { id: userId } });
  }
}
