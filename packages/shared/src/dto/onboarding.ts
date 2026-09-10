/**
 * [G8] "Première séance" — the gamified onboarding checklist. Separate from
 * the mandatory first-run `OnboardingWizard` (domains/theme/notifications):
 * this one is a discreet, non-blocking checklist that rewards a tour of the
 * app's core actions at the user's own pace, once the wizard is closed.
 *
 * Steps are locked in a fixed order (see the [B10] design discussion): a
 * step becomes actionable only once every step before it is done or
 * skipped, though later steps stay visible at reduced opacity rather than
 * hidden. `create_list`/`comment` only apply when `SOCIAL_ENABLED` — see
 * `OnboardingService`.
 */
export const ONBOARDING_STEP_KEYS = [
  "add_title",
  "mark_complete",
  "rate",
  "complete_profile",
  "import",
  "create_list",
  "comment",
] as const;

export type OnboardingStepKey = (typeof ONBOARDING_STEP_KEYS)[number];

/** Steps that only make sense — and only ever get offered — when `SOCIAL_ENABLED`. */
export const ONBOARDING_SOCIAL_STEPS: OnboardingStepKey[] = [
  "create_list",
  "comment",
];

export interface OnboardingStepDto {
  key: OnboardingStepKey;
  /** True once the underlying action has genuinely happened — re-derived live, never cached as an event. */
  done: boolean;
  /** True once the user explicitly chose to move past this step. One-way: there is no "unskip". */
  skipped: boolean;
}

export interface OnboardingChecklistDto {
  /** In display order — see `ONBOARDING_STEP_KEYS`. Empty when gamification is off. */
  steps: OnboardingStepDto[];
  /** True once every step is done or skipped. Drives the panel's own disappearance — there is no manual dismiss. */
  allDone: boolean;
}
