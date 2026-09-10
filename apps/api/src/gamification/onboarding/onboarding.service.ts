import {
  ErrorCode,
  ONBOARDING_SOCIAL_STEPS,
  ONBOARDING_STEP_KEYS,
  type OnboardingChecklistDto,
  type OnboardingStepKey,
} from "@loomkeep/shared";
import { HttpStatus, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AppException } from "../../common/app.exception";
import { FeatureFlagsService } from "../../feature-flags/feature-flags.service";
import { PrismaService } from "../../prisma/prisma.service";
import { isSocialEnabled } from "../../social/social.config";
import { AchievementService } from "../achievements/achievement.service";
import { isGamificationEnabled } from "../gamification.config";
import { computeOnboardingDoneMap } from "./onboarding.util";

const COMPLETION_ACHIEVEMENT_KEY = "premiere_seance";

/**
 * [G8] "Première séance": a discreet, self-paced checklist of first actions
 * — separate from the mandatory first-run `OnboardingWizard` (settings, not
 * a tour of the app). No step ever grants XP on its own (see the [B10]
 * design discussion) — the only reward is `premiere_seance`
 * (achievements/registry.ts), unlocked once every applicable step is done
 * or skipped.
 */
@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly flags: FeatureFlagsService,
    private readonly achievements: AchievementService,
  ) {}

  async getChecklist(userId: string): Promise<OnboardingChecklistDto> {
    if (!isGamificationEnabled(this.config, this.flags)) {
      return { steps: [], allDone: true };
    }

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        onboardingSkippedSteps: true,
        onboardingGamifiedCompletedAt: true,
      },
    });

    // Already finished — served as a stable fact independent of the
    // achievement catalogue (see the schema's note on this field), so a
    // future rework of the checklist's steps never re-proposes it.
    if (user.onboardingGamifiedCompletedAt) {
      return { steps: [], allDone: true };
    }

    const socialEnabled = isSocialEnabled(this.config, this.flags);
    const applicableKeys = ONBOARDING_STEP_KEYS.filter(
      (key) => socialEnabled || !ONBOARDING_SOCIAL_STEPS.includes(key),
    );

    // A social step that never even applies on this deployment is treated as
    // skipped, persisted once — the same fact `checkPremiereSeance` reads,
    // so the achievement never needs its own feature-flag awareness (see the
    // [G8] design discussion on why this reuses `onboardingSkippedSteps`
    // rather than adding one to every achievement `check()`).
    const inapplicable = ONBOARDING_STEP_KEYS.filter(
      (key) =>
        ONBOARDING_SOCIAL_STEPS.includes(key) &&
        !socialEnabled &&
        !user.onboardingSkippedSteps.includes(key),
    );
    const skipped = inapplicable.length
      ? await this.appendSkipped(
          userId,
          user.onboardingSkippedSteps,
          inapplicable,
        )
      : user.onboardingSkippedSteps;

    const doneMap = await computeOnboardingDoneMap(this.prisma, userId);
    const steps = applicableKeys.map((key) => ({
      key,
      done: doneMap[key],
      skipped: skipped.includes(key),
    }));
    const allDone = steps.every((s) => s.done || s.skipped);

    if (allDone) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { onboardingGamifiedCompletedAt: new Date() },
      });
      await this.achievements.evaluate(userId, [COMPLETION_ACHIEVEMENT_KEY]);
    }

    return { steps, allDone };
  }

  /** One-way: skipping is a deliberate move-past, there is no "unskip". */
  async skip(userId: string, key: string): Promise<OnboardingChecklistDto> {
    if (!ONBOARDING_STEP_KEYS.includes(key as OnboardingStepKey)) {
      throw new AppException(HttpStatus.BAD_REQUEST, ErrorCode.InvalidParam);
    }

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { onboardingSkippedSteps: true },
    });

    if (!user.onboardingSkippedSteps.includes(key)) {
      await this.appendSkipped(userId, user.onboardingSkippedSteps, [
        key as OnboardingStepKey,
      ]);
    }

    return this.getChecklist(userId);
  }

  private async appendSkipped(
    userId: string,
    current: string[],
    additions: OnboardingStepKey[],
  ): Promise<string[]> {
    const next = [...current, ...additions];
    await this.prisma.user.update({
      where: { id: userId },
      data: { onboardingSkippedSteps: next },
    });
    return next;
  }
}
