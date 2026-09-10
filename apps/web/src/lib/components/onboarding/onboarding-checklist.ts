// [G8] "Première séance" — the gamified onboarding checklist. Shared between
// the desktop widget (OnboardingWidget) and the mobile banner
// (OnboardingBanner), which render the exact same steps in two different
// shells (see the [G8] design discussion on why mobile can't reuse
// NotificationBell's old floating-corner idiom).
import { m } from "$lib/paraglide/messages.js";
import type { IconName } from "$lib/types/icon-name";
import type { OnboardingStepDto, OnboardingStepKey } from "@loomkeep/shared";

interface StepConfig {
  icon: IconName;
  /**
   * Where the "go do it" click lands. Three steps ("mark complete", "rate",
   * "comment") have no single canonical target — they all act on a
   * not-yet-chosen tracked item — so they fall back to the app home rather
   * than guessing a domain, per the [G8] design discussion.
   */
  href: string;
}

export const STEP_CONFIG: Record<OnboardingStepKey, StepConfig> = {
  add_title: { icon: "plus", href: "/app/search" },
  // Not "check" — that glyph is reserved for the row's own "done" indicator
  // (OnboardingChecklistRows), and re-using it here made a current, not-yet-
  // done "mark complete" row indistinguishable from an actually done one.
  mark_complete: { icon: "trophy", href: "/app" },
  rate: { icon: "star", href: "/app" },
  complete_profile: { icon: "user", href: "/app/profile" },
  import: { icon: "download", href: "/app/settings/import" },
  create_list: { icon: "list", href: "/app/profile" },
  comment: { icon: "message", href: "/app" },
};

const STEP_LABEL: Record<OnboardingStepKey, () => string> = {
  add_title: m.gamification_onboarding_step_add_title,
  mark_complete: m.gamification_onboarding_step_mark_complete,
  rate: m.gamification_onboarding_step_rate,
  complete_profile: m.gamification_onboarding_step_complete_profile,
  import: m.gamification_onboarding_step_import,
  create_list: m.gamification_onboarding_step_create_list,
  comment: m.gamification_onboarding_step_comment,
};

export function stepLabel(key: OnboardingStepKey): string {
  return STEP_LABEL[key]();
}

const STEP_DESCRIPTION: Record<OnboardingStepKey, () => string> = {
  add_title: m.gamification_onboarding_step_add_title_desc,
  mark_complete: m.gamification_onboarding_step_mark_complete_desc,
  rate: m.gamification_onboarding_step_rate_desc,
  complete_profile: m.gamification_onboarding_step_complete_profile_desc,
  import: m.gamification_onboarding_step_import_desc,
  create_list: m.gamification_onboarding_step_create_list_desc,
  comment: m.gamification_onboarding_step_comment_desc,
};

/** One line on how to actually clear the step — shown for current/locked, never needed once done or skipped. */
export function stepDescription(key: OnboardingStepKey): string {
  return STEP_DESCRIPTION[key]();
}

type OnboardingStepState = "done" | "skipped" | "current" | "locked";

export interface OnboardingStepView extends OnboardingStepDto {
  state: OnboardingStepState;
}

/**
 * Steps are locked in order (see the [G8] design discussion): the first
 * not-done-and-not-skipped step is the actionable "current" one, everything
 * after it is "locked" — shown, at reduced opacity, never hidden.
 */
export function deriveStepViews(
  steps: OnboardingStepDto[],
): OnboardingStepView[] {
  let currentAssigned = false;
  return steps.map((step) => {
    if (step.done) return { ...step, state: "done" };
    if (step.skipped) return { ...step, state: "skipped" };

    if (!currentAssigned) {
      currentAssigned = true;
      return { ...step, state: "current" };
    }

    return { ...step, state: "locked" };
  });
}
