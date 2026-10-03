import {
  ErrorCode,
  ModerationMeasure,
  type AdminReportsSummaryDto,
  type PagedResult,
  type ReportCategory,
  type ReportDto,
  type ReportMotif,
  type ReportPendingCountDto,
  type ReportStatus,
  type ReportTargetType,
} from "@loomkeep/shared";
import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Logger,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import type { Prisma } from "@prisma/client";
import { AuthService } from "../auth/auth.service";
import {
  CurrentUser,
  type JwtPayload,
} from "../auth/decorators/current-user.decorator";
import { CommentService } from "../comments/comment.service";
import { AppException } from "../common/app.exception";
import { PagedResponseDto } from "../common/dto/paged-response.dto";
import { parsePageQuery } from "../common/pagination.util";
import { ListService } from "../lists/list.service";
import { PrismaService } from "../prisma/prisma.service";
import { ModerationReasonBody } from "../reports/dto/moderation-reason.dto";
import { ProfileMeasuresBody } from "../reports/dto/profile-measures.dto";
import { ReportPendingCountResponseDto } from "../reports/dto/report-pending-count-response.dto";
import { ReportResponseDto } from "../reports/dto/report-response.dto";
import { ResolveReportBody } from "../reports/dto/resolve-report.dto";
import {
  ModerationDecisionService,
  type ModerationDecisionIdentity,
  type RecordModerationDecisionInput,
} from "../reports/moderation-decision.service";
import { REPORT_PAGE_SIZE, ReportService } from "../reports/report.service";
import { ReviewService } from "../reviews/review.service";
import { AdminOnly } from "./admin-only.decorator";
import {
  foundedPercent,
  medianResolutionHours,
  rankReporters,
} from "./admin-social-stats.util";
import { AdminReportsSummaryResponseDto } from "./dto/admin-reports-summary-response.dto";

const STATUSES: ReportStatus[] = ["PENDING", "RESOLVED", "DISMISSED"];

type PendingReport = {
  targetType: ReportTargetType;
  targetId: string;
  category: ReportCategory | null;
  motif: ReportMotif | null;
};

/** The moderation queue fed by the "signaler" buttons. */
@AdminOnly()
@Controller("admin/reports")
export class AdminReportsController {
  private readonly logger = new Logger(AdminReportsController.name);

  constructor(
    private readonly reports: ReportService,
    private readonly comments: CommentService,
    private readonly reviews: ReviewService,
    private readonly prisma: PrismaService,
    private readonly moderationDecisions: ModerationDecisionService,
    private readonly lists: ListService,
    private readonly auth: AuthService,
  ) {}

  @Get()
  @ApiOkResponse({ type: PagedResponseDto(ReportResponseDto) })
  list(
    @Query("status") status?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("reporterId") reporterId?: string,
  ): Promise<PagedResult<ReportDto>> {
    const parsed = parsePageQuery(page, limit, REPORT_PAGE_SIZE);
    return this.reports.list(
      STATUSES.includes(status as ReportStatus)
        ? (status as "PENDING" | "RESOLVED" | "DISMISSED")
        : undefined,
      parsed.page,
      reporterId,
      parsed.limit,
    );
  }

  /**
   * Page-header figures over the whole queue, not the current page on screen.
   * Shares the /admin/stats moderation helpers so the two pages can't disagree
   * on the same numbers.
   */
  @Get("summary")
  @ApiOkResponse({ type: AdminReportsSummaryResponseDto })
  async summary(): Promise<AdminReportsSummaryDto> {
    const [pending, resolved, dismissed, closed, byReporter] =
      await Promise.all([
        this.prisma.report.count({ where: { status: "PENDING" } }),
        this.prisma.report.count({ where: { status: "RESOLVED" } }),
        this.prisma.report.count({ where: { status: "DISMISSED" } }),
        this.prisma.report.findMany({
          where: { resolvedAt: { not: null } },
          select: { createdAt: true, resolvedAt: true },
        }),
        this.prisma.report.groupBy({
          by: ["reporterId"],
          _count: { _all: true },
        }),
      ]);

    // Reports from a deleted reporter (reporterId SetNull) aren't attributable
    // to anyone, so they're excluded from the per-reporter ranking below.
    const counts = new Map(
      byReporter
        .filter((r) => r.reporterId !== null)
        .map((r) => [r.reporterId as string, r._count._all] as const),
    );
    const users = await this.prisma.user.findMany({
      where: { id: { in: [...counts.keys()] } },
      select: { id: true, username: true },
    });

    return {
      pending,
      resolved,
      dismissed,
      medianResolutionHours: medianResolutionHours(
        closed.map((r) => ({
          createdAt: r.createdAt,
          // Narrowed by the `not: null` filter above.
          resolvedAt: r.resolvedAt as Date,
        })),
      ),
      foundedPercent: foundedPercent(resolved, dismissed),
      topReporters: rankReporters(
        counts,
        new Map(users.map((u) => [u.id, u.username])),
      ),
    };
  }

  @Get("pending-count")
  @ApiOkResponse({ type: ReportPendingCountResponseDto })
  async pendingCount(): Promise<ReportPendingCountDto> {
    return { count: await this.reports.pendingCount() };
  }

  @Post(":id/resolve")
  resolve(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() body: ResolveReportBody,
  ): Promise<void> {
    return this.reports.resolve(user.sub, id, body.status);
  }

  /**
   * Removes the reported content itself (comment tombstone or review
   * deletion), persists its author's DSA art. 17 notice, and resolves the
   * report in one transaction. Email delivery follows the commit.
   */
  @Post(":id/take-down")
  async takeDown(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() body: ModerationReasonBody,
  ): Promise<void> {
    const committed = await this.prisma.$transaction(async (tx) => {
      const report = await tx.report.findUnique({
        where: { id },
        select: {
          targetType: true,
          targetId: true,
          category: true,
          motif: true,
          status: true,
        },
      });
      if (!report || report.status !== "PENDING")
        throw new AppException(
          HttpStatus.NOT_FOUND,
          ErrorCode.AdminReportNotFound,
        );

      const removal = await this.removeContent(
        report.targetType,
        report.targetId,
        tx,
      );
      let notice:
        (RecordModerationDecisionInput & { reportId: string }) | null = null;
      let notifiedAuthorId: string | null = null;
      let decision: ModerationDecisionIdentity | null = null;

      if (removal?.authorId) {
        const author = await tx.user.findUnique({
          where: { id: removal.authorId },
          select: { email: true, locale: true, username: true },
        });

        if (author) {
          notice = {
            measure: removal.measure,
            targetType: report.targetType,
            targetId: report.targetId,
            subjectUserId: removal.authorId,
            subjectEmail: author.email,
            subjectLocale: author.locale,
            subjectUsername: author.username,
            legalBasis: body.legalBasis,
            reasonCategory: report.category,
            reasonMotif: report.motif,
            reasonText: body.reasonText,
            tosClause: body.tosClause,
            contentSnapshot: removal.snapshot,
            decidedById: user.sub,
            reportId: id,
          };
          decision =
            await this.moderationDecisions.recordForReportInTransaction(
              tx,
              notice,
            );
          notifiedAuthorId = removal.authorId;
        }
      }

      const reporterId = await this.reports.resolveInTransaction(
        tx,
        user.sub,
        id,
        "RESOLVED",
      );
      return { removal, reporterId, notice, notifiedAuthorId, decision };
    });

    try {
      this.reports.publishResolution(committed.reporterId);

      if (committed.removal?.commentTarget) {
        this.comments.publishAdminRemoval(
          committed.removal.commentTarget.type,
          committed.removal.commentTarget.id,
        );
      }

      if (committed.notifiedAuthorId) {
        this.moderationDecisions.publishForReport(committed.notifiedAuthorId);
      }
    } catch (err) {
      this.logger.warn(
        "A moderation realtime notification could not be published",
        err,
      );
    }

    if (committed.notice && committed.decision) {
      void this.moderationDecisions
        .sendEmail(committed.notice, committed.decision)
        .catch((err) => {
          this.logger.warn("A moderation email could not be sent", err);
        });
    }
  }

  /**
   * Deletes a reported list for everyone, its editors included, keeping its
   * title and description on the decision as evidence.
   */
  @Post(":id/list-removal")
  async removeList(
    @CurrentUser() admin: JwtPayload,
    @Param("id") id: string,
    @Body() body: ModerationReasonBody,
  ): Promise<void> {
    await this.decide(
      admin.sub,
      id,
      "LIST",
      async (tx, report) => {
        const removed = await this.lists.adminRemove(report.targetId, tx);
        const snapshot = [removed.title, removed.description]
          .filter(Boolean)
          .join("\n");
        return {
          subjectUserId: removed.ownerId,
          measures: [
            {
              measure: ModerationMeasure.LIST_REMOVED,
              snapshot: `${snapshot}\n(${removed.itemCount})`,
            },
          ],
        };
      },
      body,
    );
  }

  /**
   * Records the decision for a reported list the admin already edited from
   * its own page (ListService grants MODERATOR access while the report is
   * pending), so its owner gets the statement of reasons.
   */
  @Post(":id/list-edited")
  async recordListEdit(
    @CurrentUser() admin: JwtPayload,
    @Param("id") id: string,
    @Body() body: ModerationReasonBody,
  ): Promise<void> {
    await this.decide(
      admin.sub,
      id,
      "LIST",
      async (tx, report) => {
        const list = await tx.list.findUnique({
          where: { id: report.targetId },
          select: { userId: true, title: true, description: true },
        });
        if (!list)
          throw new AppException(HttpStatus.NOT_FOUND, ErrorCode.ListNotFound);
        return {
          subjectUserId: list.userId,
          measures: [
            {
              measure: ModerationMeasure.LIST_EDITED,
              snapshot: [list.title, list.description]
                .filter(Boolean)
                .join("\n"),
            },
          ],
        };
      },
      body,
    );
  }

  /**
   * Any combination of photo removal, bio removal, display-name change and
   * suspension on a reported profile: one decision row per measure, one
   * notice. A suspension also ends every session at once.
   */
  @Post(":id/profile-measures")
  async takeProfileMeasures(
    @CurrentUser() admin: JwtPayload,
    @Param("id") id: string,
    @Body() body: ProfileMeasuresBody,
  ): Promise<void> {
    const suspendUntil = body.suspendUntil ? new Date(body.suspendUntil) : null;
    const displayName = body.displayName?.trim();

    if (
      (suspendUntil && suspendUntil <= new Date()) ||
      !(body.removeAvatar || body.clearBio || displayName || suspendUntil)
    ) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.ValidationFailed,
        undefined,
        "Pick at least one measure, and a suspension end in the future",
      );
    }

    const subjectUserId = await this.decide(
      admin.sub,
      id,
      "USER",
      async (tx, report) => {
        const subject = await tx.user.findUnique({
          where: { id: report.targetId },
          select: { bio: true, displayName: true },
        });
        if (!subject)
          throw new AppException(HttpStatus.NOT_FOUND, ErrorCode.UserNotFound);

        await tx.user.update({
          where: { id: report.targetId },
          data: {
            ...(body.removeAvatar && {
              avatar: null,
              avatarMimeType: null,
              avatarUpdatedAt: null,
            }),
            ...(body.clearBio && { bio: null }),
            ...(displayName && { displayName }),
            ...(suspendUntil && { suspendedUntil: suspendUntil }),
          },
        });

        return {
          subjectUserId: report.targetId,
          suspendedUntil: suspendUntil,
          measures: [
            ...(body.removeAvatar
              ? [{ measure: ModerationMeasure.AVATAR_REMOVED, snapshot: null }]
              : []),
            ...(body.clearBio
              ? [
                  {
                    measure: ModerationMeasure.BIO_CLEARED,
                    snapshot: subject.bio,
                  },
                ]
              : []),
            ...(displayName
              ? [
                  {
                    measure: ModerationMeasure.DISPLAY_NAME_CHANGED,
                    snapshot: subject.displayName,
                  },
                ]
              : []),
            ...(suspendUntil
              ? [
                  {
                    measure: ModerationMeasure.ACCOUNT_SUSPENDED,
                    snapshot: null,
                  },
                ]
              : []),
          ],
        };
      },
      body,
    );

    if (suspendUntil) await this.auth.revokeAllSessions(subjectUserId);
  }

  /**
   * The shared shape of a report-driven measure: apply it, persist one
   * decision per measure and resolve the report in one transaction, then
   * publish and send the single notice. Returns the sanctioned user's id.
   */
  private async decide(
    adminId: string,
    reportId: string,
    targetType: ReportTargetType,
    apply: (
      tx: Prisma.TransactionClient,
      report: PendingReport,
    ) => Promise<{
      subjectUserId: string;
      suspendedUntil?: Date | null;
      measures: { measure: ModerationMeasure; snapshot: string | null }[];
    }>,
    body: ModerationReasonBody,
  ): Promise<string> {
    const committed = await this.prisma.$transaction(async (tx) => {
      const report = await tx.report.findUnique({
        where: { id: reportId },
        select: {
          targetType: true,
          targetId: true,
          category: true,
          motif: true,
          status: true,
        },
      });
      if (
        !report ||
        report.status !== "PENDING" ||
        report.targetType !== targetType
      )
        throw new AppException(
          HttpStatus.NOT_FOUND,
          ErrorCode.AdminReportNotFound,
        );

      const applied = await apply(tx, report);
      const subject = await tx.user.findUniqueOrThrow({
        where: { id: applied.subjectUserId },
        select: { email: true, locale: true, username: true },
      });
      const notices = applied.measures.map(
        ({
          measure,
          snapshot,
        }): RecordModerationDecisionInput & {
          reportId: string;
        } => ({
          measure,
          targetType: report.targetType,
          targetId: report.targetId,
          subjectUserId: applied.subjectUserId,
          subjectEmail: subject.email,
          subjectLocale: subject.locale,
          subjectUsername: subject.username,
          legalBasis: body.legalBasis,
          reasonCategory: report.category,
          reasonMotif: report.motif,
          reasonText: body.reasonText,
          tosClause: body.tosClause,
          contentSnapshot: snapshot,
          decidedById: adminId,
          reportId,
        }),
      );
      const decisions =
        await this.moderationDecisions.recordManyForReportInTransaction(
          tx,
          notices,
        );
      const reporterId = await this.reports.resolveInTransaction(
        tx,
        adminId,
        reportId,
        "RESOLVED",
      );
      return { applied, notices, decisions, reporterId };
    });

    try {
      this.reports.publishResolution(committed.reporterId);
      this.moderationDecisions.publishForReport(
        committed.applied.subjectUserId,
      );
    } catch (err) {
      this.logger.warn(
        "A moderation realtime notification could not be published",
        err,
      );
    }

    void this.moderationDecisions
      .sendNotice(
        committed.notices,
        committed.decisions,
        committed.applied.suspendedUntil,
      )
      .catch((err) => {
        this.logger.warn("A moderation email could not be sent", err);
      });

    return committed.applied.subjectUserId;
  }

  /**
   * Removes the reported content for the target types that support a
   * take-down; null for the others (USER/LIST), which have their own
   * endpoints above.
   */
  private async removeContent(
    targetType: ReportTargetType,
    targetId: string,
    tx: Prisma.TransactionClient,
  ): Promise<{
    measure: ModerationMeasure;
    authorId: string | null;
    snapshot: string | null;
    commentTarget?: { type: string; id: string };
  } | null> {
    if (targetType === "COMMENT") {
      const {
        authorId,
        text,
        targetType: type,
        targetId: id,
      } = await this.comments.adminRemove(targetId, tx);
      return {
        measure: ModerationMeasure.COMMENT_REMOVED,
        authorId,
        snapshot: text,
        commentTarget: { type, id },
      };
    }

    if (targetType === "REVIEW") {
      const { authorId, rating, text } = await this.reviews.adminRemove(
        targetId,
        tx,
      );
      return {
        measure: ModerationMeasure.REVIEW_REMOVED,
        authorId,
        snapshot: text ? `${rating}/10 — ${text}` : `${rating}/10`,
      };
    }

    return null;
  }
}
