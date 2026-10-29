import type { SavedViewDomain } from "@loomkeep/shared";
export const STORAGE_KEYS = {
  theme: "lk-theme",
  motion: "lk-a11y-motion",
  contrast: "lk-a11y-contrast",
  density: "lk-a11y-density",
  navStyle: "lk-nav-style",
  railPinned: "lk-rail-pinned",
  lastKnownPrefix: "lk-last-known-",
  reviewDraftPrefix: "lk-review-draft-",
  onboardingStep: "lk-onboarding-step",
  dismissedNews: "lk-news-banner-dismissed",
  reauthMethod: "lk-reauth-method",
  passkeySuggested: "lk-passkey-suggested",
  nativePushToken: "lk-native-push-token",
  libraryView: (domain: SavedViewDomain) =>
    `lk-library-view-${domain.toLowerCase()}`,
  libraryColumns: (domain: SavedViewDomain) =>
    `lk-library-columns-${domain.toLowerCase()}`,
};
export const LEGACY_STORAGE_KEYS = {
  lastKnownPrefix: "loomkeep.lastKnown.",
  reviewDraftPrefix: "loomkeep.reviewDraft.",
  onboardingStep: "loomkeep.onboarding-step",
  dismissedNews: "news-banner-dismissed",
  tokens: "loomkeep.tokens",
};
