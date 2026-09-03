import {
  ErrorCode,
  XpReason,
  type AchievementDto,
  type PendingAchievementDto,
} from "@loomkeep/shared";
import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron } from "@nestjs/schedule";
import { Prisma } from "@prisma/client";
import { AppException } from "../../common/app.exception";
import { FeatureFlagsService } from "../../feature-flags/feature-flags.service";
import { JOB_KEYS } from "../../jobs/job-keys";
import { JobRunService } from "../../jobs/job-run.service";
import { PrismaService } from "../../prisma/prisma.service";
import { isSocialEnabled } from "../../social/social.config";
import { isGamificationEnabled } from "../gamification.config";
import { XpService } from "../xp.service";
import {
  ACHIEVEMENT_LIST,
  ACHIEVEMENTS,
  type AchievementDefinition,
} from "./registry";

/**
 * Unlocks achievements — the engine behind the registry declared in
 * `registry.ts`. Achievements are permanent: once a `UserAchievement` row
 * exists, `evaluate()` never re-checks or removes it, unlike `XpService`'s
 * ledger (see the [G2] plan — a trophy isn't taken back because the
 * underlying activity later changes).
 */
@Injectable()
export class AchievementService {
  private readonly logger = new Logger(AchievementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly flags: FeatureFlagsService,
    private readonly xp: XpService,
    private readonly jobRuns: JobRunService,
  ) {}

  /**
   * Re-checks and unlocks achievements for `userId` — every definition in
   * the registry, or only `keys` when a caller already knows which ones a
   * just-credited XP reason can affect (see ACHIEVEMENT_KEYS_BY_XP_REASON).
   * No-ops entirely when gamification is off.
   */
  async evaluate(userId: string, keys?: string[]): Promise<void> {
    if (!isGamificationEnabled(this.config, this.flags)) return;

    const definitions = keys
      ? keys
          .map((key) => ACHIEVEMENTS[key])
          .filter((d): d is AchievementDefinition => d !== undefined)
      : ACHIEVEMENT_LIST;

    for (const definition of definitions) {
      await this.evaluateOne(userId, definition);
    }
  }

  private async evaluateOne(
    userId: string,
    definition: AchievementDefinition,
  ): Promise<void> {
    if (definition.socialGated && !isSocialEnabled(this.config, this.flags))
      return;

    const already = await this.prisma.userAchievement.findUnique({
      where: { userId_key: { userId, key: definition.key } },
      select: { id: true },
    });
    if (already) return;

    const result = await definition.check(this.prisma, userId);
    if (!result.unlocked) return;

    await this.grant(userId, definition);
  }

  /**
   * Creates the unlock row and credits its XP. Shared by the check-driven
   * path (evaluateOne) and the event-driven one (markVersionLinkClicked), so
   * both get the same concurrency handling and the same "XP only if this
   * call actually created the row" guarantee.
   */
  private async grant(
    userId: string,
    definition: AchievementDefinition,
  ): Promise<void> {
    let created;

    try {
      created = await this.prisma.userAchievement.create({
        data: { userId, key: definition.key },
      });
    } catch (err) {
      // A concurrent evaluate() call (live wiring racing the nightly sweep,
      // or two live sites in the same request) hits the unique constraint —
      // expected under concurrency, not an error. No XP credit in this case:
      // the call that actually created the row already credited it.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        this.logger.debug(
          `Achievement ${definition.key} already unlocked for user ${userId} (concurrent)`,
        );
        return;
      }

      throw err;
    }

    await this.xp.award(
      userId,
      XpReason.ACHIEVEMENT_UNLOCKED,
      created.id,
      definition.xpAward,
    );
  }

  /**
   * "curious_cat" signal: the user clicked the version-number link
   * (home/settings). The only event-granted achievement in the catalogue —
   * the click leaves no other trace in the data model, so there is nothing
   * for a check() to re-derive it from, and the UserAchievement row is
   * itself the record that it happened. Idempotent: the unique constraint on
   * (userId, key) makes a second call a no-op that never re-credits XP.
   */
  async markVersionLinkClicked(userId: string): Promise<void> {
    if (!isGamificationEnabled(this.config, this.flags)) return;

    const definition = ACHIEVEMENTS.curious_cat;
    const already = await this.prisma.userAchievement.findUnique({
      where: { userId_key: { userId, key: definition.key } },
      select: { id: true },
    });
    if (already) return;

    await this.grant(userId, definition);
  }

  /**
   * The whole catalogue projected for `userId` — one entry per registry key,
   * unlocked or not, for the [G5] achievements screen. Empty list rather
   * than an error when gamification is off (the web gates on
   * `appConfig.gamificationEnabled`, so no extra guard here — same shape as
   * `pending()`).
   *
   * A locked secret is returned masked (see `AchievementDto`): its `check()`
   * is never even run, since nothing about it may reach the client.
   */
  async list(userId: string): Promise<AchievementDto[]> {
    if (!isGamificationEnabled(this.config, this.flags)) return [];

    const socialEnabled = isSocialEnabled(this.config, this.flags);
    const unlockedRows = await this.prisma.userAchievement.findMany({
      where: { userId },
      select: { key: true, unlockedAt: true },
    });
    const unlockedAtByKey = new Map(
      unlockedRows.map((r) => [r.key, r.unlockedAt]),
    );

    // A socialGated entry can never unlock with social off (evaluateOne
    // skips it), so showing it would only advertise a surface this instance
    // doesn't have — same reasoning as SocialFeatureGuard's 404.
    const definitions = ACHIEVEMENT_LIST.filter(
      (d) => socialEnabled || !d.socialGated,
    );

    return Promise.all(
      definitions.map((definition) =>
        this.project(userId, definition, unlockedAtByKey.get(definition.key)),
      ),
    );
  }

  private async project(
    userId: string,
    definition: AchievementDefinition,
    unlockedAt: Date | undefined,
  ): Promise<AchievementDto> {
    const unlocked = unlockedAt !== undefined;

    if (definition.secret && !unlocked) {
      return {
        key: null,
        family: definition.family,
        tierOf: null,
        tier: null,
        xpAward: null,
        secret: true,
        unlocked: false,
        unlockedAt: null,
        progress: null,
      };
    }

    const result = await definition.check(this.prisma, userId);

    return {
      key: definition.key,
      family: definition.family,
      tierOf: definition.tierOf ?? null,
      tier: definition.tier ?? null,
      xpAward: definition.xpAward,
      secret: definition.secret ?? false,
      unlocked,
      unlockedAt: unlockedAt?.toISOString() ?? null,
      progress: result.progress ?? null,
    };
  }

  /**
   * Unlocked achievements the [G6] unlock-bubble UI hasn't shown yet, oldest
   * first (the order the bubble sequence should play them in). Empty list
   * rather than an error when gamification is off.
   */
  async pending(userId: string): Promise<PendingAchievementDto[]> {
    if (!isGamificationEnabled(this.config, this.flags)) return [];

    const rows = await this.prisma.userAchievement.findMany({
      where: { userId, displayedAt: null },
      orderBy: { unlockedAt: "asc" },
    });
    if (rows.length === 0) return [];

    // xpAwarded isn't stored on UserAchievement (see the [G2] plan) — looked
    // up from the XpEntry each unlock created.
    const xpEntries = await this.prisma.xpEntry.findMany({
      where: {
        sourceType: "UserAchievement",
        sourceId: { in: rows.map((r) => r.id) },
      },
      select: { sourceId: true, amount: true },
    });
    const xpBySourceId = new Map(xpEntries.map((e) => [e.sourceId, e.amount]));

    return rows.map((r) => ({
      id: r.id,
      key: r.key,
      unlockedAt: r.unlockedAt.toISOString(),
      xpAwarded: xpBySourceId.get(r.id) ?? 0,
    }));
  }

  /**
   * Marks one achievement as shown by the unlock-bubble UI. Idempotent (a
   * second call is a no-op) and scoped to `userId` — a mismatch or unknown
   * id both 404, never revealing whether the id belongs to someone else.
   */
  async markDisplayed(userId: string, id: string): Promise<void> {
    const achievement = await this.prisma.userAchievement.findUnique({
      where: { id },
      select: { userId: true, displayedAt: true },
    });

    if (!achievement || achievement.userId !== userId) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.GamificationAchievementNotFound,
      );
    }

    if (achievement.displayedAt !== null) return;

    await this.prisma.userAchievement.update({
      where: { id },
      data: { displayedAt: new Date() },
    });
  }

  /**
   * Nightly safety net: re-evaluates every achievement for every user. This
   * is what catches anything not wired to a live award site (see the [G2]
   * plan) — including, on its first run after deploy, every existing
   * account's history, with no separate backfill script needed (`check()`
   * never cares whether a row came from live use or an import).
   *
   * Full sweep, every user, no activity-based targeting: acceptable while
   * the registry only has two achievement families (see the [G2] plan) —
   * targeting active users only should be revisited once [G3]'s full
   * catalogue makes this loop expensive, not solved preemptively here.
   */
  @Cron("0 5 * * *")
  async runAchievementsSweepJob(): Promise<string> {
    return this.jobRuns.record(
      JOB_KEYS.GAMIFICATION_ACHIEVEMENTS_SWEEP,
      () => this.sweepAllUsers(),
      (summary) => summary,
    );
  }

  private async sweepAllUsers(): Promise<string> {
    const users = await this.prisma.user.findMany({ select: { id: true } });

    for (const user of users) {
      await this.evaluate(user.id);
    }

    return `Swept ${users.length} user(s)`;
  }
}
