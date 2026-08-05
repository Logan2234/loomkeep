import type {
  Domain,
  ProfileAccess,
  VisibilityAudience,
  VisibilityFacet,
} from "../enums";
import type { LabelCountDto } from "./stats";

/** Minimal identity of a user, for lists (followers, following, requests). */
export interface UserSummaryDto {
  id: string;
  username: string;
  displayName: string;
  profileAccess: ProfileAccess;
  /**
   * Set when this identity was swapped for a Figurant's derived pseudonym
   * (comment/review authorship) — `username` is then empty and `displayName`
   * holds the pseudo, never the real one. Absent/false everywhere else.
   */
  anonymized?: boolean;
  /**
   * Consecutive-day video-watch streak, for the small 🎬 badge shown next to
   * a pseudo (profile header, reviews, comments) — Snapchat-flame style. Only
   * populated where the caller actually computes it; absent/0 means "no
   * badge". Never set for an anonymized (Figurant) author.
   */
  streakDays?: number;
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
 * Video-derived activity summary shown on a profile (streak, heatmap teaser,
 * genres…) — deliberately video-only (the only domain with a per-event log),
 * gated as one block by the MEDIA domain's ACTIVITY facet.
 */
export interface ProfileActivityStatsDto {
  visible: boolean;
  /** Consecutive days (ending today or yesterday) with at least one watch. */
  streakDays: number;
  firstActivityAt: string | null;
  lastActivityAt: string | null;
  totalMinutes: number;
  mostActiveYear: number | null;
  /** Top 3 genres by viewing count — for display chips. */
  topGenres: LabelCountDto[];
  /** Daily watch counts, last 90 days, zero-filled — a teaser for /stats. */
  heatmap: { date: string; count: number }[];
}

/** A user's social profile as seen by a given viewer (post-visibility). */
export interface SocialProfileDto {
  id: string;
  username: string;
  displayName: string;
  bio: string | null;
  profileAccess: ProfileAccess;
  createdAt: string;
  followerCount: number;
  followingCount: number;
  relationship: RelationshipDto;
  domains: ProfileDomainStatDto[];
  activityStats: ProfileActivityStatsDto;
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
