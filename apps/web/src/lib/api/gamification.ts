import type {
  AchievementDto,
  MyProgressionDto,
  PendingAchievementDto,
} from "@loomkeep/shared";
import { request } from "./core";

/**
 * The whole achievement catalogue projected for the signed-in user — one
 * entry per registry key, unlocked or not, with still-locked secrets already
 * masked server-side (see AchievementDto). Empty when GAMIFICATION_ENABLED
 * is off. Same reason as signalVersionLinkClicked below for not going
 * through `typedRequest`: the endpoint isn't in the generated OpenAPI schema.
 */
export function getAchievements(): Promise<AchievementDto[]> {
  return request<AchievementDto[]>("/achievements");
}

/**
 * "curious_cat" signal (see the [G3] plan) — fire-and-forget, the caller
 * never awaits this: the version-link click itself (opening the GitHub repo
 * in a new tab) must never be blocked or delayed by the network call. Not
 * wired through `typedRequest` (../generated/typed-request.ts) since that
 * needs the endpoint in the generated OpenAPI schema, and this is a plain
 * empty-body POST with nothing worth the codegen round-trip for.
 */
export function signalVersionLinkClicked(): void {
  request("/achievements/signals/version-link", { method: "POST" }).catch(
    () => {
      // Best-effort only — a failed signal just means curious_cat doesn't
      // unlock this time, nothing the user needs to see or retry.
    },
  );
}

/**
 * Unlocks the [G6] bubble hasn't shown yet (`displayedAt IS NULL`), oldest
 * first — the order the sequence plays them in. Shipped by [G2]; nothing
 * about it is new here. Empty when GAMIFICATION_ENABLED is off.
 *
 * Note that this is *self*-addressed data: `hideProgression` is deliberately
 * not consulted anywhere on this path. That setting hides your progression
 * from *other viewers* (see `withXp()` in the API's xp-lookup.util.ts) — the
 * owner always sees their own, and a bubble only ever speaks to its owner.
 */
export function getPendingAchievements(): Promise<PendingAchievementDto[]> {
  return request<PendingAchievementDto[]>("/achievements/pending");
}

/**
 * Marks one unlock as shown. Fire-and-forget for the same reason as
 * signalVersionLinkClicked: the bubble must never wait on the network to
 * move on. The endpoint is idempotent and the row simply stays pending on
 * failure, so the worst case is the bubble replaying at the next app open.
 */
export function markAchievementDisplayed(id: string): void {
  request(`/achievements/${id}/displayed`, { method: "PATCH" }).catch(() => {
    // See above — a failed mark costs one replay, nothing the user can act on.
  });
}

/**
 * The viewer's own XP total. Served by the gamification module rather than
 * read off the social profile: everything under /social is behind
 * SocialFeatureGuard, and the "solo first" guardrail requires levels to keep
 * working on a SOCIAL_ENABLED=false instance. `xp` is null when
 * gamification itself is off; the level is derived client-side.
 */
export function getMyProgression(): Promise<MyProgressionDto> {
  return request<MyProgressionDto>("/gamification/me");
}
