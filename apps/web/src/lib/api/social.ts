import type { UpdateVisibilitySettingsDto } from "@loomkeep/shared";
import { typedRequest } from "./generated/typed-request";

export const getProfile = (username: string) =>
  typedRequest("/social/users/{username}", { params: { username } });

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
