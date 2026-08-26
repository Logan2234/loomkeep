// "Nouveau" badge visibility for recently shipped features. Time-based
// rather than a per-user dismissal flag — simplest thing that works: the
// badge just fades out on its own NEW_BADGE_DAYS after shipping, no state to
// track or reset.
const NEW_BADGE_DAYS = 21;

// Feature key -> ISO date it shipped. Add an entry when you ship something
// worth flagging, remove it once its window has passed (or just let it sit —
// isFeatureNew() returns false past the window either way).
const SHIPPED: Record<string, string> = {
  "calendar-subscribe": "2026-08-09",
  "locale-english": "2026-08-09",
  newsletter: "2026-08-09",
  "help-feedback": "2026-08-10",
  support: "2026-08-10",
  "collaborative-lists": "2026-08-11",
  "reading-goal": "2026-08-11",
  "import-trakt": "2026-08-17",
  "import-simkl": "2026-08-17",
  "notification-digest": "2026-08-25",
  "nav-styles": "2026-08-26",
  mfa: "2026-08-26",
};

export function isFeatureNew(key: keyof typeof SHIPPED): boolean {
  const shippedAt = SHIPPED[key];
  if (!shippedAt) return false;
  const ageDays = (Date.now() - new Date(shippedAt).getTime()) / 86_400_000;
  return ageDays >= 0 && ageDays < NEW_BADGE_DAYS;
}
