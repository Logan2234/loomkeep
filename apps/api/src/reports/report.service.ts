import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import {
  REPORT_CATEGORY_MOTIFS,
  type ReportCategory,
  type ReportDto,
  type ReportMotif,
  type ReportPageDto,
  type ReportTargetSummaryDto,
  type ReportTargetType,
  type UserSummaryDto,
} from "@loomkeep/shared";
import { resolveWorkHref } from "../common/work-href.util";
import { JOB_KEYS } from "../jobs/job-keys";
import { JobRunService } from "../jobs/job-run.service";
import { MailService } from "../mail/mail.service";
import { PrismaService } from "../prisma/prisma.service";

const PAGE_SIZE = 20;
const EXCERPT_LENGTH = 120;

const REPORTER_SELECT = {
  id: true,
  username: true,
  displayName: true,
  profileAccess: true,
} as const;

@Injectable()
export class ReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly jobRuns: JobRunService,
  ) {}

  /**
   * Files a report against a polymorphic target. Fire-and-forget from the
   * caller's POV. OTHER requires a non-empty `reason` (it has no motif to
   * fall back on); every other category requires a `motif` that actually
   * belongs to it — REPORT_CATEGORY_MOTIFS is the single source of truth for
   * that pairing, shared with the picker UI.
   */
  async create(
    reporterId: string,
    targetType: ReportTargetType,
    targetId: string,
    category: ReportCategory,
    motif?: ReportMotif,
    reason?: string,
  ): Promise<void> {
    if (category === "OTHER") {
      if (!reason?.trim()) {
        throw new BadRequestException(
          "Un détail est requis pour la catégorie « Autre »",
        );
      }
    } else if (!motif || !REPORT_CATEGORY_MOTIFS[category].includes(motif)) {
      throw new BadRequestException("Motif invalide pour cette catégorie");
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
  }

  async pendingCount(): Promise<number> {
    return this.prisma.report.count({ where: { status: "PENDING" } });
  }

  async findOne(
    id: string,
  ): Promise<{ targetType: ReportTargetType; targetId: string } | null> {
    const report = await this.prisma.report.findUnique({
      where: { id },
      select: { targetType: true, targetId: true },
    });
    return report
      ? {
          targetType: report.targetType as ReportTargetType,
          targetId: report.targetId,
        }
      : null;
  }

  async list(
    status: "PENDING" | "RESOLVED" | "DISMISSED" | undefined,
    page: number,
    reporterId?: string,
  ): Promise<ReportPageDto> {
    const rows = await this.prisma.report.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(reporterId ? { reporterId } : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { reporter: { select: REPORTER_SELECT } },
    });

    const reports = await Promise.all(
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
        reporter: r.reporter as UserSummaryDto,
        target: await this.resolveTarget(
          r.targetType as ReportTargetType,
          r.targetId,
        ),
      })),
    );

    return { reports, page };
  }

  async resolve(
    adminId: string,
    id: string,
    status: "RESOLVED" | "DISMISSED",
  ): Promise<void> {
    const { count } = await this.prisma.report.updateMany({
      where: { id, status: "PENDING" },
      data: { status, resolvedAt: new Date(), resolvedById: adminId },
    });
    if (count === 0) throw new NotFoundException();
  }

  /**
   * Reports filed against a user: directly (targetType USER) or against a
   * comment they authored. Reviews/lists aren't covered — no filing UI exists
   * for those targets yet (see resolveTarget). Not paginated: an admin-drawer
   * shortcut, not the moderation queue itself.
   */
  async listAgainstUser(userId: string): Promise<ReportDto[]> {
    const authoredCommentIds = await this.prisma.comment.findMany({
      where: { authorId: userId },
      select: { id: true },
    });

    const rows = await this.prisma.report.findMany({
      where: {
        OR: [
          { targetType: "USER", targetId: userId },
          {
            targetType: "COMMENT",
            targetId: { in: authoredCommentIds.map((c) => c.id) },
          },
        ],
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 50,
      include: { reporter: { select: REPORTER_SELECT } },
    });

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
        reporter: r.reporter as UserSummaryDto,
        target: await this.resolveTarget(
          r.targetType as ReportTargetType,
          r.targetId,
        ),
      })),
    );
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
      select: { email: true },
    });

    await Promise.all(
      admins.map((a) => this.mail.sendReportsDigest(a.email, pending)),
    );

    return admins.length;
  }

  private async resolveTarget(
    targetType: ReportTargetType,
    targetId: string,
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
        targetOwnerUsername: comment.author.username,
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
        href: `/u/${user.username}`,
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
        href: `/lists/${targetId}`,
        targetOwnerUsername: list.user.username,
      };
    }

    // REVIEW: no reporting UI wired to reviews yet (P4 backlog) — resolve
    // generically so the queue still renders if one is ever filed.
    return {
      label: `review:${targetId}`,
      href: null,
      targetOwnerUsername: null,
    };
  }
}
