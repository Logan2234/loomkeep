import {
  ErrorCode,
  ModerationMeasure,
  type AdminReportsSummaryDto,
  type ReportPageDto,
  type ReportStatus,
} from "@loomkeep/shared";
import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import {
  CurrentUser,
  type JwtPayload,
} from "../auth/decorators/current-user.decorator";
import { CommentService } from "../comments/comment.service";
import { AppException } from "../common/app.exception";
import { PrismaService } from "../prisma/prisma.service";
import { ModerationReasonBody } from "../reports/dto/moderation-reason.dto";
import { ResolveReportBody } from "../reports/dto/resolve-report.dto";
import { ModerationDecisionService } from "../reports/moderation-decision.service";
import { ReportService } from "../reports/report.service";
import { AdminOnly } from "./admin-only.decorator";
import {
  foundedPercent,
  medianResolutionHours,
  rankReporters,
} from "./admin-social-stats.util";

const STATUSES: ReportStatus[] = ["PENDING", "RESOLVED", "DISMISSED"];

/** The comment/review/user moderation queue fed by the "signaler" button. */
@AdminOnly()
@Controller("admin/reports")
export class AdminReportsController {
  constructor(
    private readonly reports: ReportService,
    private readonly comments: CommentService,
    private readonly prisma: PrismaService,
    private readonly moderationDecisions: ModerationDecisionService,
  ) {}

  @Get()
  list(
    @Query("status") status?: string,
    @Query("page") page?: string,
    @Query("reporterId") reporterId?: string,
  ): Promise<ReportPageDto> {
    return this.reports.list(
      STATUSES.includes(status as ReportStatus)
        ? (status as "PENDING" | "RESOLVED" | "DISMISSED")
        : undefined,
      page ? Math.max(1, Number(page)) : 1,
      reporterId,
    );
  }

  /**
   * Page-header figures over the whole queue, not the cursor page on screen.
   * Shares the /admin/stats moderation helpers so the two pages can't disagree
   * on the same numbers.
   */
  @Get("summary")
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
  async pendingCount(): Promise<{ count: number }> {
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
   * Removes the reported content itself (comment tombstone today), notifies
   * its author with the DSA art. 17 statement of reasons, then resolves the
   * report.
   */
  @Post(":id/take-down")
  async takeDown(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() body: ModerationReasonBody,
  ): Promise<void> {
    const report = await this.reports.findOne(id);
    if (!report)
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.AdminReportNotFound,
      );

    if (report.targetType === "COMMENT") {
      const { authorId, text } = await this.comments.adminRemove(
        report.targetId,
      );

      if (authorId) {
        const author = await this.prisma.user.findUnique({
          where: { id: authorId },
          select: { email: true, username: true },
        });

        if (author) {
          await this.moderationDecisions.record({
            measure: ModerationMeasure.COMMENT_REMOVED,
            targetType: report.targetType,
            targetId: report.targetId,
            subjectUserId: authorId,
            subjectEmail: author.email,
            subjectUsername: author.username,
            legalBasis: body.legalBasis,
            reasonCategory: report.category,
            reasonMotif: report.motif,
            reasonText: body.reasonText,
            tosClause: body.tosClause,
            contentSnapshot: text,
            decidedById: user.sub,
            reportId: id,
          });
        }
      }
    }

    await this.reports.resolve(user.sub, id, "RESOLVED");
  }
}
