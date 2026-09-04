import type {
  SocialProfileDto,
  UpdateVisibilitySettingsDto,
} from "@loomkeep/shared";
import { request } from "./core";
import { typedRequest } from "./generated/typed-request";

export const getProfile = (username: string) =>
  typedRequest("/social/users/{username}", { params: { username } });

/**
 * Your own profile, served by the users module rather than the social one:
 * everything under /social is behind SocialFeatureGuard, so on a
 * SOCIAL_ENABLED=false instance `getProfile` 404s and the profile page —
 * level, XP, streak, per-domain counts, none of it social — had nothing to
 * render. Same payload either way.
 */
export const getMyProfile = () =>
  request<SocialProfileDto>("/users/me/profile");

export const followUser = (username: string) =>
  typedRequest("/social/users/{username}/follow", {
    method: "POST",
    params: { username },
  });

export const unfollowUser = (username: string) =>
  typedRequest("/social/users/{username}/follow", {
    method: "DELETE",
    params: { username },
  });

export const blockUser = (username: string) =>
  typedRequest("/social/users/{username}/block", {
    method: "POST",
    params: { username },
  });

export const unblockUser = (username: string) =>
  typedRequest("/social/users/{username}/block", {
    method: "DELETE",
    params: { username },
  });

export const getFollowRequests = () => typedRequest("/social/requests");

export const acceptFollowRequest = (id: string): Promise<void> =>
  typedRequest("/social/requests/{id}/accept", {
    method: "POST",
    params: { id },
  });

export const rejectFollowRequest = (id: string): Promise<void> =>
  typedRequest("/social/requests/{id}/reject", {
    method: "POST",
    params: { id },
  });

export const getUserFollowers = (username: string) =>
  typedRequest("/social/users/{username}/followers", {
    params: { username },
  });

export const getUserFollowing = (username: string) =>
  typedRequest("/social/users/{username}/following", {
    params: { username },
  });

export const getPrivacySettings = () => typedRequest("/social/me/privacy");

export const updatePrivacySettings = (body: UpdateVisibilitySettingsDto) =>
  typedRequest("/social/me/privacy", { method: "PATCH", body });

export const getGhostSwitchImpact = () =>
  typedRequest("/social/me/privacy/ghost-impact");
