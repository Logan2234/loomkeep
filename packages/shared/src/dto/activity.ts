import type { ActivityType, Domain } from "../enums";

/** Minimal identity of the person an activity event belongs to. */
export interface ActivityActorDto {
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

/** Granularity of an activity event's target, per the feed matrix. */
export type ActivityLevel = "WORK" | "SEASON" | "EPISODE";

/**
 * An event's feed domain — the six content `Domain`s, plus `"LISTS"` for
 * cross-domain list events (not a real content domain, so not added to the
 * `Domain` enum itself — a list isn't one of the things `enabledDomains`
 * toggles). Visibility gating for `"LISTS"` events bypasses the per-domain
 * facet system entirely (see `ActivityService.filterVisible`) since a list's
 * own visibility field is what governs it, same as `Review`.
 */
export type ActivityDomain = Domain | "LISTS";

/** One activity-feed event (post-visibility), with its target snapshot. */
export interface ActivityEventDto {
  id: string;
  type: ActivityType;
  domain: ActivityDomain;
  /** "MEDIA" | "GAME" | "BOOK" | "MUSIC" — the work's domain, singular. */
  targetType: string;
  level: ActivityLevel;
  /** Denormalised target snapshot at emit time. */
  title: string;
  imageUrl: string | null;
  /** Client link to the work, or null. */
  href: string | null;
  /** Kind-specific extras: `{ rating }`, `{ seasonNumber, episodeNumber }`… */
  data: Record<string, unknown>;
  createdAt: string;
  actor: ActivityActorDto;
  /**
   * How many like events were collapsed into this one (read-time aggregation of
   * a binge). 1 for a standalone event; >1 for an aggregated PROGRESS run.
   */
  count: number;
}
