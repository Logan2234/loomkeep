import {
  ErrorCode,
  NotificationType,
  REPORT_CATEGORY_MOTIFS,
  isReportCategoryAllowed,
  type PagedResult,
  type ReportCategory,
  type ReportDto,
  type ReportMotif,
  type ReportTargetSummaryDto,
  type ReportTargetType,
} from "@loomkeep/shared";
import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import type { Prisma } from "@prisma/client";
import { AppException } from "../common/app.exception";
import { resolveWorkHref } from "../common/work-href.util";
import { EventsGateway } from "../events/events.gateway";
import { JOB_KEYS } from "../jobs/job-keys";
import { JobRunService } from "../jobs/job-run.service";
import { MailService } from "../mail/mail.service";
import { notificationCopy } from "../notifications/notification-copy";
import { NotificationService } from "../notifications/notification.service";
import { PrismaService } from "../prisma/prisma.service";
import { toUserSummaryDto } from "../users/avatar.util";

export const REPORT_PAGE_SIZE = 20;
const EXCERPT_LENGTH = 120;

type ReportRow = {
  id: string;
  targetType: string;
  targetId: string;
  category: string | null;
  motif: string | null;
  reason: string | null;
  status: string;
  createdAt: Date;
  resolvedAt: Date | null;
  reporter: Parameters<typeof toUserSummaryDto>[0] | null;
};

type ReviewTarget = {
  rating: number;
  text: string | null;
  targetType: string;
  targetId: string;
  user: { username: string } | null;
};

const REPORTER_SELECT = {
  id: true,
  username: true,
  displayName: true,
  profileAccess: true,
  avatarUpdatedAt: true,
} as const;

@Injectable()
export class ReportService {
  private readonly logger = new Logger(ReportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly jobRuns: JobRunService,
    private readonly notifications: NotificationService,
    private readonly events: EventsGateway,
  ) {}

  /**
   * Files a report against a polymorphic target. Fire-and-forget from the
   * caller's POV. OTHER requires a non-empty `reason` (it has no motif to
   * fall back on); every other category requires a `motif` that actually
   * belongs to it — REPORT_CATEGORY_MOTIFS is the single source of truth for
   * that pairing, shared with the picker UI.
   *
   * DSA art. 16(4)'s receipt confirmation is the caller's own success toast
   * (e.g. CommentThread.svelte) — synchronous with submission, nothing "without
   * undue delay" could beat that. See notifyReporterOfResolution for the
   * art. 16(5) notice sent once the report is resolved.
   */
  async create(
    reporterId: string,
    targetType: ReportTargetType,
    targetId: string,
    category: ReportCategory,
    motif?: ReportMotif,
    reason?: string,
  ): Promise<void> {
    if (!isReportCategoryAllowed(category, targetType)) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.ReportInvalidMotif,
        undefined,
        "This category doesn't apply to this content",
      );
    }

    if (category === "OTHER") {
      if (!reason?.trim()) {
        throw new AppException(
          HttpStatus.BAD_REQUEST,
          ErrorCode.ReportReasonRequired,
          undefined,
          "A detail is required for the 'Other' category",
        );
      }
    } else if (!motif || !REPORT_CATEGORY_MOTIFS[category].includes(motif)) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.ReportInvalidMotif,
        undefined,
        "Invalid motif for this category",
      );
    }

    const ownerId = await this.reportableContentOwner(targetType, targetId);

    if (ownerId === reporterId) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        ErrorCode.ReportCannotReportOwnContent,
      );
    }

    const pending = await this.prisma.report.findFirst({
      where: { reporterId, targetType, targetId, status: "PENDING" },
      select: { id: true },
    });

    if (pending) {
      throw new AppException(HttpStatus.CONFLICT, ErrorCode.ReportAlreadyFiled);
    }

    await this.prisma.report.create({
      data: {
        reporterId,
        targetType,
        targetId,
        category,
        motif: category === "OTHER" ? null : motif,
        reason: reason?.trim() || null,
      },
    });

    this.events.emitReportsCount();
  }

  /**
   * The author of a reportable piece of content (null once their account is
   * gone), 404ing when the content itself no longer exists. `undefined` for
   * target types filed without an ownership check (USER, LIST).
   */
  private async reportableContentOwner(
    targetType: ReportTargetType,
    targetId: string,
  ): Promise<string | null | undefined> {
    if (targetType === "COMMENT") {
      const comment = await this.prisma.comment.findUnique({
        where: { id: targetId },
        select: { authorId: true, deletedAt: true },
      });

      if (!comment || comment.deletedAt) {
        throw new AppException(HttpStatus.NOT_FOUND, ErrorCode.CommentNotFound);
      }

      return comment.authorId;
    }

    if (targetType === "REVIEW") {
      const review = await this.prisma.review.findUnique({
        where: { id: targetId },
        select: { userId: true },
      });

      if (!review) {
        throw new AppException(HttpStatus.NOT_FOUND, ErrorCode.ReviewNotFound);
      }

      return review.userId;
    }

    return undefined;
  }

  async pendingCount(): Promise<number> {
    return this.prisma.report.count({ where: { status: "PENDING" } });
  }

  async findOne(id: string): Promise<{
    targetType: ReportTargetType;
    targetId: string;
    category: ReportCategory | null;
    motif: ReportMotif | null;
  } | null> {
    const report = await this.prisma.report.findUnique({
      where: { id },
      select: { targetType: true, targetId: true, category: true, motif: true },
    });
    return report
      ? {
          targetType: report.targetType as ReportTargetType,
          targetId: report.targetId,
          category: report.category as ReportCategory | null,
          motif: report.motif as ReportMotif | null,
        }
      : null;
  }

  async list(
    status: "PENDING" | "RESOLVED" | "DISMISSED" | undefined,
    page: number,
    reporterId?: string,
    limit = REPORT_PAGE_SIZE,
  ): Promise<PagedResult<ReportDto>> {
    const rows = await this.prisma.report.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(reporterId ? { reporterId } : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * limit,
      take: limit + 1,
      include: { reporter: { select: REPORTER_SELECT } },
    });
    const hasMore = rows.length > limit;

    return { items: await this.toDtos(rows.slice(0, limit)), hasMore };
  }

  async resolve(
    adminId: string,
    id: string,
    status: "RESOLVED" | "DISMISSED",
  ): Promise<void> {
    const reporterId = await this.prisma.$transaction((tx) =>
      this.resolveInTransaction(tx, adminId, id, status),
    );
    this.publishResolution(reporterId);
  }

  /** Persists the outcome and the art. 16(5) notice before either becomes visible. */
  async resolveInTransaction(
    tx: Prisma.TransactionClient,
    adminId: string,
    id: string,
    status: "RESOLVED" | "DISMISSED",
  ): Promise<string | null> {
    const { count } = await tx.report.updateMany({
      where: { id, status: "PENDING" },
      data: { status, resolvedAt: new Date(), resolvedById: adminId },
    });
    if (count === 0)
      throw new AppException(HttpStatus.NOT_FOUND, ErrorCode.ReportNotFound);

    const report = await tx.report.findUnique({
      where: { id },
      select: { reporter: { select: { id: true, locale: true } } },
    });
    if (!report?.reporter) return null;

    const copy = notificationCopy(report.reporter.locale).reportResolution;
    const created = await this.notifications.createInTransaction(tx, {
      userId: report.reporter.id,
      type: NotificationType.REPORT_RESOLVED,
      title: copy.title,
      body: status === "RESOLVED" ? copy.resolved : copy.dismissed,
      dedupeKey: `report:${id}:resolved`,
    });
    return created ? report.reporter.id : null;
  }

  publishResolution(reporterId: string | null): void {
    try {
      this.events.emitReportsCount();
    } catch (err) {
      this.logger.warn(
        "The live admin report count could not be published",
        err,
      );
    }

    if (reporterId) {
      try {
        this.notifications.publishCreated(
          reporterId,
          NotificationType.REPORT_RESOLVED,
        );
      } catch (err) {
        this.logger.warn(
          "The reporter notification could not be published",
          err,
        );
      }
    }
  }

  /**
   * Reports filed against a user: directly (targetType USER) or against a
   * comment or review they authored. Lists aren't covered — no filing UI
   * exists for them yet (see resolveTarget). Not paginated: an admin-drawer
   * shortcut, not the moderation queue itself.
   */
  async listAgainstUser(userId: string): Promise<ReportDto[]> {
    const [authoredCommentIds, authoredReviewIds] = await Promise.all([
      this.prisma.comment.findMany({
        where: { authorId: userId },
        select: { id: true },
      }),
      this.prisma.review.findMany({
        where: { userId },
        select: { id: true },
      }),
    ]);

    const rows = await this.prisma.report.findMany({
      where: {
        OR: [
          { targetType: "USER", targetId: userId },
          {
            targetType: "COMMENT",
            targetId: { in: authoredCommentIds.map((c) => c.id) },
          },
          {
            targetType: "REVIEW",
            targetId: { in: authoredReviewIds.map((r) => r.id) },
          },
        ],
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 50,
      include: { reporter: { select: REPORTER_SELECT } },
    });

    return this.toDtos(rows);
  }

  private async toDtos(rows: ReportRow[]): Promise<ReportDto[]> {
    const reviews = await this.reviewTargets(
      rows.filter((r) => r.targetType === "REVIEW").map((r) => r.targetId),
    );

    return Promise.all(
      rows.map(async (r): Promise<ReportDto> => ({
        id: r.id,
        targetType: r.targetType as ReportTargetType,
        targetId: r.targetId,
        category: r.category as ReportCategory | null,
        motif: r.motif as ReportMotif | null,
        reason: r.reason,
        status: r.status as ReportDto["status"],
        createdAt: r.createdAt.toISOString(),
        resolvedAt: r.resolvedAt?.toISOString() ?? null,
        reporter: r.reporter ? toUserSummaryDto(r.reporter) : null,
        target: await this.resolveTarget(
          r.targetType as ReportTargetType,
          r.targetId,
          reviews,
        ),
      })),
    );
  }

  /** Every reported review of a page in one query, keyed by id. */
  private async reviewTargets(
    ids: string[],
  ): Promise<Map<string, ReviewTarget>> {
    if (ids.length === 0) return new Map();
    const rows = await this.prisma.review.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        rating: true,
        text: true,
        targetType: true,
        targetId: true,
        user: { select: { username: true } },
      },
    });
    return new Map(rows.map((r) => [r.id, r]));
  }

  /** Daily 7h admin-only digest of pending reports. Skipped entirely when there's nothing pending. */
  @Cron("0 7 * * *")
  async sendDailyDigest(): Promise<number> {
    return this.jobRuns.record(
      JOB_KEYS.REPORTS_DIGEST,
      () => this.runDailyDigest(),
      (sent) =>
        sent > 0 ? `Envoyé à ${sent} admin(s)` : "Aucun signalement en attente",
    );
  }

  private async runDailyDigest(): Promise<number> {
    const pending = await this.pendingCount();
    if (pending === 0) return 0;

    const admins = await this.prisma.user.findMany({
      where: { role: "ADMIN" },
      select: { email: true, locale: true },
    });

    await Promise.all(
      admins.map((a) =>
        this.mail.sendReportsDigest(
          { email: a.email, locale: a.locale },
          pending,
        ),
      ),
    );

    return admins.length;
  }

  private async resolveTarget(
    targetType: ReportTargetType,
    targetId: string,
    reviews: Map<string, ReviewTarget>,
  ): Promise<ReportTargetSummaryDto | null> {
    if (targetType === "COMMENT") {
      const comment = await this.prisma.comment.findUnique({
        where: { id: targetId },
        select: {
          text: true,
          deletedAt: true,
          targetType: true,
          targetId: true,
          author: { select: { username: true } },
        },
      });
      if (!comment) return null;
      const excerpt = comment.deletedAt
        ? "(commentaire supprimé)"
        : (comment.text ?? "").slice(0, EXCERPT_LENGTH);
      return {
        // No "@username — " prefix: the client renders the owner's username as
        // its own clickable link (targetOwnerUsername), not embedded in text.
        label: excerpt,
        href: await resolveWorkHref(
          this.prisma,
          comment.targetType,
          comment.targetId,
        ),
        targetOwnerUsername: comment.author?.username ?? null,
      };
    }

    if (targetType === "USER") {
      const user = await this.prisma.user.findUnique({
        where: { id: targetId },
        select: { username: true },
      });
      if (!user) return null;
      return {
        label: "Profil utilisateur",
        href: `/app/u/${user.username}`,
        targetOwnerUsername: user.username,
      };
    }

    if (targetType === "LIST") {
      const list = await this.prisma.list.findUnique({
        where: { id: targetId },
        select: { title: true, user: { select: { username: true } } },
      });
      if (!list) return null;
      return {
        label: list.title,
        href: `/app/lists/${targetId}`,
        targetOwnerUsername: list.user.username,
      };
    }

    const review = reviews.get(targetId);
    if (!review) return null;
    const excerpt = (review.text ?? "").slice(0, EXCERPT_LENGTH);
    const label = excerpt
      ? `${review.rating}/10 — ${excerpt}`
      : `${review.rating}/10`;
    return {
      label: review.user ? label : `${label} (auteur supprimé)`,
      href: await resolveWorkHref(
        this.prisma,
        review.targetType,
        review.targetId,
      ),
      targetOwnerUsername: review.user?.username ?? null,
    };
  }
}
