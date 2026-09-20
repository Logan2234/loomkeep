import {
  ErrorCode,
  ModerationMeasure,
  type AdminReportsSummaryDto,
  type PagedResult,
  type ReportDto,
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
import {
  CurrentUser,
  type JwtPayload,
} from "../auth/decorators/current-user.decorator";
import { CommentService } from "../comments/comment.service";
import { AppException } from "../common/app.exception";
import { PagedResponseDto } from "../common/dto/paged-response.dto";
import { parsePageQuery } from "../common/pagination.util";
import { PrismaService } from "../prisma/prisma.service";
import { ModerationReasonBody } from "../reports/dto/moderation-reason.dto";
import { ReportPendingCountResponseDto } from "../reports/dto/report-pending-count-response.dto";
import { ReportResponseDto } from "../reports/dto/report-response.dto";
import { ResolveReportBody } from "../reports/dto/resolve-report.dto";
import { ModerationDecisionService } from "../reports/moderation-decision.service";
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

/** The comment/review/user moderation queue fed by the "signaler" button. */
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
      let decisionId: string | null = null;
      let notifiedAuthorId: string | null = null;

      if (removal?.authorId) {
        const author = await tx.user.findUnique({
          where: { id: removal.authorId },
          select: { email: true, locale: true, username: true },
        });

        if (author) {
          decisionId = await this.moderationDecisions.queueForReport(tx, {
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
          });
          notifiedAuthorId = removal.authorId;
        }
      }

      const reporterId = await this.reports.resolveInTransaction(
        tx,
        user.sub,
        id,
        "RESOLVED",
      );
      return { removal, reporterId, decisionId, notifiedAuthorId };
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
        this.moderationDecisions.publishQueued(committed.notifiedAuthorId);
      }
    } catch (err) {
      this.logger.warn(
        "A moderation realtime notification could not be published",
        err,
      );
    }

    if (committed.decisionId) {
      // The committed outbox row survives a crash before this immediate attempt.
      void this.moderationDecisions
        .deliver(committed.decisionId)
        .catch((err) => {
          this.logger.warn(
            "A queued moderation email could not be dispatched",
            err,
          );
        });
    }
  }

  /**
   * Removes the reported content for the target types that support a
   * take-down; null for the others (USER/LIST), which only get resolved.
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
