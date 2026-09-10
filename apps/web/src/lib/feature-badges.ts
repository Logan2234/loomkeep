const NEW_BADGE_DAYS = 21;

const SHIPPED = {
  "notification-digest": "2026-08-25",
  "nav-styles": "2026-08-26",
  mfa: "2026-08-26",
  achievements: "2026-09-03",
  leaderboard: "2026-09-05",
  myanimelist: "2026-09-09",
  "book-edition-selector": "2026-09-10",
};

type FeatureBadgeKey = keyof typeof SHIPPED;

export function isFeatureNew(key: string): boolean {
  const shippedAt = SHIPPED[key as FeatureBadgeKey];
  if (!shippedAt) return false;
  const ageDays = (Date.now() - new Date(shippedAt).getTime()) / 86_400_000;
  return ageDays >= 0 && ageDays < NEW_BADGE_DAYS;
}
