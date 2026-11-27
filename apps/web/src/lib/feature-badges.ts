const NEW_BADGE_DAYS = 21;

const SHIPPED = {
  "profile-figures": "2026-11-27",
  "invite-link": "2026-11-25",
  "country-map": "2026-11-25",
  "arr-feeds": "2026-11-25",
  loans: "2026-11-24",
  "game-languages": "2026-11-24",
  "upgrade-notes": "2026-11-24",
  "game-stores": "2026-11-23",
  "listen-links": "2026-11-23",
  "episode-ratings": "2026-11-23",
  "instance-domains": "2026-11-22",
  "admin-user-page": "2026-11-22",
  "free-to-read": "2026-11-22",
  "acquisition-source": "2026-11-18",
  "studio-pages": "2026-11-17",
  "creator-pages": "2026-11-10",
  rewatch: "2026-11-09",
  "chat-list-actions": "2026-11-09",
  "phone-home": "2026-11-06",
  "onboarding-replay": "2026-11-05",
  "library-filters": "2026-11-05",
  "admin-import-alert": "2026-11-18",
  premieres: "2026-11-19",
  "instance-count": "2026-11-19",
};

export type FeatureBadgeKey = keyof typeof SHIPPED;

export function isFeatureNew(key: FeatureBadgeKey): boolean {
  const shippedAt = SHIPPED[key];
  return !!shippedAt && isRecentlyShipped(shippedAt, Date.now());
}

/**
 * Whether a `YYYY-MM-DD` ship date still earns its badge at `now`. The date
 * starts at the viewer's midnight: a bare date parses as UTC's, which hid
 * the badge for the first hour of its day in France.
 */
export function isRecentlyShipped(shippedAt: string, now: number): boolean {
  const shippedDay = new Date(`${shippedAt}T00:00:00`).getTime();
  const ageDays = (now - shippedDay) / 86_400_000;
  return ageDays >= 0 && ageDays < NEW_BADGE_DAYS;
}
