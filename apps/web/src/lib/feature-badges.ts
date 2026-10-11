const NEW_BADGE_DAYS = 21;

const SHIPPED = {
  "movie-releases": "2026-10-03",
  "game-releases": "2026-10-04",
  "book-sagas": "2026-10-04",
  "game-sagas": "2026-10-04",
  "xp-history": "2026-10-05",
  messages: "2026-10-07",
  "share-work": "2026-10-09",
  "default-list-visibility": "2026-10-10",
  sagas: "2026-10-03",
  "library-sagas": "2026-10-04",
  "admin-user-filters": "2026-09-23",
  "account-activity": "2026-09-24",
  "release-feed": "2026-09-25",
  "home-layout": "2026-09-25",
  "saved-views": "2026-09-26",
  "game-time-to-beat": "2026-09-27",
  pile: "2026-09-27",
  "activity-feed": "2026-09-27",
  "episode-alerts-mute": "2026-09-27",
  "calendar-redesign": "2026-09-27",
  "migration-export": "2026-09-27",
  sessions: "2026-09-27",
  "watch-providers": "2026-09-27",
  "admin-invitations": "2026-09-27",
  "library-views": "2026-09-28",
  "quick-add": "2026-09-29",
  integrations: "2026-10-01",
  "alert-settings": "2026-10-02",
};

export type FeatureBadgeKey = keyof typeof SHIPPED;

export function isFeatureNew(key: FeatureBadgeKey): boolean {
  const shippedAt = SHIPPED[key];
  if (!shippedAt) return false;
  const ageDays = (Date.now() - new Date(shippedAt).getTime()) / 86_400_000;
  return ageDays >= 0 && ageDays < NEW_BADGE_DAYS;
}
