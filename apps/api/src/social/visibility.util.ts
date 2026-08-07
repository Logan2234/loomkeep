import {
  ProfileAccess,
  type ReviewVisibility,
  VisibilityAudience,
} from "@loomkeep/shared";

/**
 * The viewer's raw relationship to a target user (viewer's point of view).
 * `blockedByTarget` is internal — it collapses the relationship to "nothing"
 * and is never surfaced (a target who blocked the viewer reads as not-found).
 */
export interface ViewerRelation {
  isSelf: boolean;
  /** Accepted outgoing follow: viewer follows target. */
  following: boolean;
  /** Pending outgoing follow: viewer requested a PRIVATE target. */
  requested: boolean;
  /** Accepted incoming follow: target follows viewer. */
  followsYou: boolean;
  /** Viewer may see the target's FRIENDS-audience content. */
  isFriend: boolean;
  /** Viewer blocked target. */
  blocking: boolean;
  /** Target blocked viewer (internal). */
  blockedByTarget: boolean;
}

/** Audience assumed when a user hasn't set a VisibilitySetting for a facet. */
export const DEFAULT_FACET_AUDIENCE: VisibilityAudience =
  VisibilityAudience.FRIENDS;

/**
 * Whether the viewer counts as a "friend" of the target — the FRIENDS audience.
 * - PUBLIC target: friendship requires a *mutual* accepted follow (following
 *   a public profile is frictionless, so mere followers aren't friends).
 * - PRIVATE target: an accepted follow already means the target approved the
 *   request (Instagram-style), so the follower is friend-level on its own.
 * - GHOST: never (can't form reciprocal links).
 */
export function computeIsFriend(
  access: ProfileAccess,
  following: boolean,
  followsYou: boolean,
): boolean {
  if (access === ProfileAccess.GHOST) return false;
  if (access === ProfileAccess.PRIVATE) return following;
  return following && followsYou;
}

/**
 * Three-state gate for opening a profile:
 * - `hidden`: must read as not-found — nothing, not even identity, is revealed
 *   (GHOST, or a block in either direction).
 * - `locked`: the profile exists and is discoverable but its content is
 *   withheld (a PRIVATE profile the viewer doesn't follow yet). Only identity +
 *   the follow-request affordance are exposed; no library, counts or bio.
 * - `full`: the viewer may see the profile and its facet-filtered content.
 */
export type ProfileVisibility = "hidden" | "locked" | "full";

export function resolveProfileVisibility(
  access: ProfileAccess,
  relation: ViewerRelation,
): ProfileVisibility {
  if (relation.isSelf) return "full";
  if (relation.blocking || relation.blockedByTarget) return "hidden";
  if (access === ProfileAccess.GHOST) return "hidden";
  if (access === ProfileAccess.PUBLIC) return "full";
  // PRIVATE: approved followers see everything, others get a locked preview.
  return relation.following ? "full" : "locked";
}

/** Whether the viewer may see the target's profile *content* (facets aside). */
export function canAccessProfile(
  access: ProfileAccess,
  relation: ViewerRelation,
): boolean {
  return resolveProfileVisibility(access, relation) === "full";
}

/**
 * Whether the viewer may see content carrying its own explicit visibility
 * (PRIVATE/FRIENDS/PUBLIC) rather than a per-domain VisibilitySetting facet —
 * the pattern `Review` and `List` both use (their own scope, never inherited
 * from the facet system). `access` still caps FRIENDS/PUBLIC the same way
 * `resolveFacet` does: a PRIVATE profile can't expose PUBLIC content to a
 * stranger.
 */
export function resolveOwnVisibility(
  ownVisibility: "PRIVATE" | "FRIENDS" | "PUBLIC",
  access: ProfileAccess,
  relation: ViewerRelation,
): boolean {
  if (relation.isSelf) return true;
  if (relation.blocking || relation.blockedByTarget) return false;
  if (access === ProfileAccess.GHOST) return false;
  if (ownVisibility === "PRIVATE") return false;
  if (ownVisibility === "PUBLIC") return access === ProfileAccess.PUBLIC;
  return computeIsFriend(access, relation.following, relation.followsYou);
}

/**
 * Reviews have one deliberate divergence from `resolveOwnVisibility`: a
 * Figurant's review stays reachable (their own audience choice doesn't
 * apply — Figurants have no friends by design) instead of being hidden
 * outright, shown to the viewer under the author's derived pseudonym
 * instead of their real identity (see `pseudonym.util.ts`). Kept as its own
 * named function — rather than an inline copy of `resolveOwnVisibility`'s
 * shape in `ReviewService.listForTarget` — so this one intentional
 * difference (GHOST → visible, not hidden) is explicit and unit-testable on
 * its own, not duplicated logic that quietly drifted. `ReviewVisibility`
 * has no PRIVATE value (a review is at least FRIENDS), so there's no
 * corresponding branch here.
 */
export function resolveReviewVisibility(
  ownVisibility: ReviewVisibility,
  access: ProfileAccess,
  relation: ViewerRelation,
): boolean {
  if (relation.isSelf) return true;
  if (relation.blocking || relation.blockedByTarget) return false;
  if (access === ProfileAccess.GHOST) return true;
  if (ownVisibility === "PUBLIC") return access === ProfileAccess.PUBLIC;
  return computeIsFriend(access, relation.following, relation.followsYou);
}

/**
 * Whether the viewer may see one passive-content facet, given its stored
 * audience. `profileAccess` acts as a cap: a PRIVATE profile can't expose a
 * facet to PUBLIC, so a PUBLIC setting is lowered to FRIENDS.
 */
export function resolveFacet(
  access: ProfileAccess,
  setting: VisibilityAudience,
  relation: ViewerRelation,
): boolean {
  if (relation.isSelf) return true;
  if (relation.blocking || relation.blockedByTarget) return false;
  if (access === ProfileAccess.GHOST) return false;

  let effective = setting;

  if (
    access === ProfileAccess.PRIVATE &&
    effective === VisibilityAudience.PUBLIC
  ) {
    effective = VisibilityAudience.FRIENDS;
  }

  switch (effective) {
    case VisibilityAudience.NONE:
      return false;
    case VisibilityAudience.FRIENDS:
      return relation.isFriend;
    case VisibilityAudience.PUBLIC:
      // Only reachable when access is PUBLIC (cap above): any logged-in,
      // non-blocked viewer qualifies (all social is behind auth + the FF).
      return true;
    default:
      return false;
  }
}
