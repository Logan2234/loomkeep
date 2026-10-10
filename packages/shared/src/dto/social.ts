import type {
  Domain,
  ProfileAccess,
  VisibilityAudience,
  VisibilityFacet,
} from "../enums";
import type { AchievementDto } from "./gamification";

/** Minimal identity of a user, for lists (followers, following, requests). */
export interface UserSummaryDto {
  id: string;
  username: string;
  displayName: string;
  profileAccess: ProfileAccess;
  /**
   * Path to the uploaded profile picture (see `UserDto.avatarUrl`), or null
   * for the identicon fallback. Always null when `anonymized` — a real photo
   * would deanonymize a Figurant.
   */
  avatarUrl: string | null;
  /**
   * Set when this identity was swapped for a Figurant's derived pseudonym
   * (comment/review authorship) — `username` is then empty and `displayName`
   * holds the pseudo, never the real one. Absent/false everywhere else.
   */
  anonymized?: boolean;
  /**
   * Total XP, for the small level pastille shown next to a pseudo (reviews,
   * comments, profile). Only populated where the caller actually computes
   * it; the level itself is derived client-side via `levelProgress()`. Never
   * set for an anonymized (Figurant) author.
   */
  xp?: number;
}

/** An account in someone's followers/following, seen from the viewer. */
export interface ConnectionDto extends UserSummaryDto {
  /** The viewer follows this account. */
  following: boolean;
  /** The viewer asked to follow this (PRIVATE) account; not accepted yet. */
  requested: boolean;
  /** A friend of the viewer — the same rule as `RelationshipDto.isFriend`. */
  isFriend: boolean;
}

/** Live counts of what a switch to Figurant mode would immediately affect. */
export interface GhostSwitchImpactDto {
  followersToRemove: number;
  outgoingFollowsToCancel: number;
  listsToDowngrade: number;
}

/**
 * The viewer's relationship to a target user, from the viewer's point of view.
 * A block by the target is never surfaced here — a target who blocked the
 * viewer reads as "not found" instead.
 */
export interface RelationshipDto {
  isSelf: boolean;
  /** Accepted outgoing follow (viewer → target): you follow them. */
  following: boolean;
  /** Pending outgoing follow: you requested to follow a PRIVATE profile. */
  requested: boolean;
  /** Accepted incoming follow (target → viewer): they follow you. */
  followsYou: boolean;
  /** Viewer sees the target's FRIENDS-audience content. */
  isFriend: boolean;
  /** You have blocked them. */
  blocking: boolean;
}

/** Per-domain library visibility + count + favorites shown on a profile. */
export interface ProfileDomainStatDto {
  domain: Domain;
  /** Whether the viewer may see this domain's library (LIBRARY facet). */
  visible: boolean;
  /** Number of library items in this domain (0 when not visible). */
  count: number;
  /** Number of favorited items in this domain (0 when not visible). */
  favorites: number;
}

/**
 * The activity streak shown on a profile (header badge, home widget): dated
 * watches, game sessions and reading sessions. Shown whatever the ACTIVITY
 * facets say — only a locked profile withholds it.
 */
export interface ProfileActivityStatsDto {
  /** False only on a locked profile, where the streak is withheld. */
  visible: boolean;
  /** Consecutive days (ending today or yesterday) with at least one activity. */
  streakDays: number;
  /**
   * Whether today already has an activity counted toward `streakDays` — i.e.
   * the streak needs nothing more before midnight to survive. Lets the badge
   * show a "you still need to do something today" cue near the end of the
   * day without the frontend re-deriving it.
   */
  streakSecuredToday: boolean;
}

/** A user's social profile as seen by a given viewer (post-visibility). */
export interface SocialProfileDto {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  profileAccess: ProfileAccess;
  createdAt: string;
  followerCount: number;
  followingCount: number;
  relationship: RelationshipDto;
  domains: ProfileDomainStatDto[];
  activityStats: ProfileActivityStatsDto;
  /**
   * Total XP, for the level/progress display (see `LevelCard` on the web —
   * the level itself derives client-side via `levelProgress()`, never sent
   * precomputed). `null` means: gamification disabled on this instance, OR
   * the viewer lacks the right to see it, OR the target has set
   * `hideProgression` — never `null` for the owner viewing their own profile.
   */
  xp: number | null;
  /**
   * Up to `MAX_EQUIPPED_BADGES` unlocked, non-secret achievements the
   * target chose to show — an empty array both when nothing is equipped and
   * whenever `xp` above would be null (same visibility rule, reused exactly
   * rather than a parallel check: gamification off, viewer not allowed to see
   * progression, or `hideProgression`). Never render a placeholder for the
   * empty case: the showcase has zero footprint when empty.
   */
  equippedBadges: AchievementDto[];
  /** Reviews with a visibility the viewer may see (own-scope, like List). */
  reviewsCount: number;
  /** Comments are public by nature — capped only by profile reachability. */
  commentsCount: number;
  /** Lists with a visibility the viewer may see (own-scope). */
  listsCount: number;
  /**
   * A PRIVATE profile the viewer can't see yet: only identity + `relationship`
   * are populated (bio/counts/domains withheld server-side). The client shows a
   * locked preview with a follow-request affordance. GHOST/blocked never reach
   * the client — they 404.
   */
  locked: boolean;
}

/** A pending incoming follow request the user can approve/reject. */
export interface FollowRequestDto {
  /** The Follow row id. */
  id: string;
  user: UserSummaryDto;
  createdAt: string;
}

/** One cell of the visibility matrix. */
export interface VisibilitySettingItemDto {
  domain: Domain;
  facet: VisibilityFacet;
  audience: VisibilityAudience;
}

/** The current user's privacy configuration (profile access + full matrix). */
export interface VisibilitySettingsDto {
  profileAccess: ProfileAccess;
  /** Resolved for every domain × facet, defaults included. */
  settings: VisibilitySettingItemDto[];
}

/** Partial update of the privacy configuration. */
export interface UpdateVisibilitySettingsDto {
  profileAccess?: ProfileAccess;
  settings?: VisibilitySettingItemDto[];
}
