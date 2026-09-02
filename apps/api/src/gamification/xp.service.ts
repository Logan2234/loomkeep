import { XP_RULES, type XpReason } from "@loomkeep/shared";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron } from "@nestjs/schedule";
import { Prisma } from "@prisma/client";
import { localDay } from "../common/local-day.util";
import { FeatureFlagsService } from "../feature-flags/feature-flags.service";
import { JOB_KEYS } from "../jobs/job-keys";
import { JobRunService } from "../jobs/job-run.service";
import { PrismaService } from "../prisma/prisma.service";
import { isSocialEnabled } from "../social/social.config";
import { isGamificationEnabled } from "./gamification.config";
import { XP_VERIFIERS, type XpVerifier } from "./xp-verifiers";

// How many XpEntry rows reconcile() verifies per batch, per reason — bounds
// memory on an instance with a large ledger instead of loading it all at once.
const RECONCILE_BATCH_SIZE = 500;

/**
 * Credits, reverses and reconciles the XP ledger — the single write path for
 * `XpEntry`/`UserScore` (see the [G1] plan). `ActivityService.emit` was
 * deliberately not reused as a base for this: it swallows its own errors and
 * isn't called from every cancellation path, which is fine for a feed but
 * not for a ledger that must never silently drift from the data it's
 * supposed to track.
 */
@Injectable()
export class XpService {
  private readonly logger = new Logger(XpService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly flags: FeatureFlagsService,
    private readonly jobRuns: JobRunService,
  ) {}

  /**
   * Credits one XP entry for `reason`/`sourceId`, if the feature is on, the
   * rule isn't social-gated behind a disabled SOCIAL_ENABLED, and the day's
   * cap for this (userId, reason) isn't already reached. No-ops otherwise —
   * every caller fire-and-forgets this the same way `ActivityService.emit`
   * is used elsewhere, so a disabled flag or an exhausted cap is never an
   * error.
   *
   * `amountOverride` is the one exception to the barème being fixed-amount:
   * XpReason.ACHIEVEMENT_UNLOCKED has no `amount` in XP_RULES (it varies by
   * achievement tier), so `AchievementService` passes the unlocked
   * definition's own `xpAward` here instead. Every other caller omits it.
   */
  async award(
    userId: string,
    reason: XpReason,
    sourceId: string,
    amountOverride?: number,
  ): Promise<void> {
    if (!isGamificationEnabled(this.config, this.flags)) return;

    const rule = XP_RULES[reason];
    if (rule.socialGated && !isSocialEnabled(this.config, this.flags)) return;
    // Only ADMIN_ADJUSTMENT (B8, not this ticket) has no fixed amount and no
    // override — its callers will set XpEntry.amount directly rather than
    // going through this registry-driven path.
    const amount = amountOverride ?? rule.amount;
    if (amount === undefined) return;

    if (rule.dailyCap !== undefined) {
      const reached = await this.dailyCapReached(userId, reason, rule.dailyCap);
      if (reached) return;
    }

    try {
      await this.prisma.xpEntry.create({
        data: {
          userId,
          reason,
          sourceType: rule.sourceType,
          sourceId,
          amount,
        },
      });
    } catch (err) {
      // A concurrent/retried award() on the same source hits the unique
      // constraint — expected under concurrency, not an error (see the
      // [G1] plan's edge case #8).
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        this.logger.debug(
          `XP entry already exists for ${reason}/${sourceId} (user ${userId})`,
        );
        return;
      }

      throw err;
    }

    await this.recomputeScore(userId);
  }

  /**
   * Credits the same reason for several sources of one user (bulk watch
   * marking). A plain loop over `award`: each call re-checks the daily cap
   * against what's already been credited (including earlier iterations of
   * this same loop), so a large batch can never bypass the cap — it just
   * stops crediting once the cap is hit.
   */
  async awardMany(
    userId: string,
    reason: XpReason,
    sourceIds: string[],
  ): Promise<void> {
    for (const sourceId of sourceIds) {
      await this.award(userId, reason, sourceId);
    }
  }

  /**
   * Reverses every XpEntry anchored to one of `sourceIds` (of `sourceType`)
   * — the entry point for every cancellation path (unwatch, delete, …).
   * Deletes the rows outright (see the [G1] plan: no revokedAt, no negative
   * entry) and resums `UserScore` for every user actually affected.
   */
  async revokeBySource(sourceType: string, sourceIds: string[]): Promise<void> {
    if (sourceIds.length === 0) return;

    const affected = await this.prisma.xpEntry.findMany({
      where: { sourceType, sourceId: { in: sourceIds } },
      select: { userId: true },
      distinct: ["userId"],
    });

    await this.prisma.xpEntry.deleteMany({
      where: { sourceType, sourceId: { in: sourceIds } },
    });

    await Promise.all(affected.map((a) => this.recomputeScore(a.userId)));
  }

  /**
   * Nightly control sweep (see the [G1] plan's "réconciliation pilotée par
   * le journal, jamais par l'état"): walks every XpEntry that has a
   * verifier (ADMIN_ADJUSTMENT never does — it's excluded, not treated as
   * always-valid), deletes the ones whose source no longer justifies them,
   * and resums the affected users' `UserScore`. Never creates XP — a
   * non-zero result is a bug signal (a cancellation path that forgot to call
   * `revokeBySource`), not routine housekeeping.
   */
  async reconcile(): Promise<Record<string, number>> {
    const corrections: Record<string, number> = {};
    const affectedUserIds = new Set<string>();

    for (const [reason, verify] of Object.entries(XP_VERIFIERS) as [
      XpReason,
      XpVerifier,
    ][]) {
      const removed = await this.reconcileReason(
        reason,
        verify,
        affectedUserIds,
      );
      if (removed > 0) corrections[reason] = removed;
    }

    await Promise.all(
      [...affectedUserIds].map((userId) => this.recomputeScore(userId)),
    );

    return corrections;
  }

  private async reconcileReason(
    reason: XpReason,
    verify: XpVerifier,
    affectedUserIds: Set<string>,
  ): Promise<number> {
    let removed = 0;
    let cursor: string | undefined;

    for (;;) {
      const batch = await this.prisma.xpEntry.findMany({
        where: { reason },
        orderBy: { id: "asc" },
        take: RECONCILE_BATCH_SIZE,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        select: { id: true, sourceId: true, userId: true },
      });
      if (batch.length === 0) break;
      cursor = batch[batch.length - 1].id;

      const staleIds: string[] = [];

      for (const entry of batch) {
        const valid = await verify(this.prisma, entry.sourceId, entry.userId);

        if (!valid) {
          staleIds.push(entry.id);
          affectedUserIds.add(entry.userId);
        }
      }

      if (staleIds.length > 0) {
        await this.prisma.xpEntry.deleteMany({
          where: { id: { in: staleIds } },
        });
        removed += staleIds.length;
      }

      if (batch.length < RECONCILE_BATCH_SIZE) break;
    }

    return removed;
  }

  @Cron("0 4 * * *")
  async runReconcileJob(): Promise<Record<string, number>> {
    return this.jobRuns.record(
      JOB_KEYS.GAMIFICATION_RECONCILE,
      () => this.reconcile(),
      summarizeReconcile,
    );
  }

  /** Resums `UserScore.xp` for `userId` from its XpEntry rows — never incremented in place. */
  private async recomputeScore(userId: string): Promise<void> {
    const agg = await this.prisma.xpEntry.aggregate({
      where: { userId },
      _sum: { amount: true },
    });
    const xp = agg._sum.amount ?? 0;

    await this.prisma.userScore.upsert({
      where: { userId },
      update: { xp },
      create: { userId, xp },
    });
  }

  /**
   * Whether `userId` already has `cap` (or more) XpEntry rows for `reason`
   * on their own local calendar day. Scoped to a 48h lookback (comfortably
   * covers every timezone's offset from server UTC time) rather than the
   * whole ledger, then filtered in memory by `localDay` — simpler than
   * deriving the local midnight-to-midnight range as UTC timestamps, and
   * cheap at these volumes (a handful of rows per user/reason/day).
   */
  private async dailyCapReached(
    userId: string,
    reason: XpReason,
    cap: number,
  ): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });
    const now = new Date();
    // An invalid stored timezone (unvalidated at write time, see
    // update-user.dto.ts) falls back to UTC rather than failing the award.
    const today = localDay(user?.timezone ?? "UTC", now) ?? isoDay(now);

    const since = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const recent = await this.prisma.xpEntry.findMany({
      where: { userId, reason, createdAt: { gte: since } },
      select: { createdAt: true },
    });

    const countToday = recent.filter(
      (e) =>
        (localDay(user?.timezone ?? "UTC", e.createdAt) ??
          isoDay(e.createdAt)) === today,
    ).length;

    return countToday >= cap;
  }
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function summarizeReconcile(corrections: Record<string, number>): string {
  const total = Object.values(corrections).reduce((sum, n) => sum + n, 0);
  if (total === 0) return "No corrections needed";
  const detail = Object.entries(corrections)
    .map(([reason, count]) => `${reason} ${count}`)
    .join(", ");
  return `${total} correction(s): ${detail}`;
}
