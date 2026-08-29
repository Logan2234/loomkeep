import type {
  FollowRequestDto,
  GhostSwitchImpactDto,
  RelationshipDto,
  SocialProfileDto,
  UpdateVisibilitySettingsDto,
  UserSummaryDto,
  VisibilitySettingsDto,
} from "@loomkeep/shared";
import { request } from "./core";

export const getProfile = (username: string): Promise<SocialProfileDto> =>
  request(`/social/users/${encodeURIComponent(username)}`);

export const followUser = (username: string): Promise<RelationshipDto> =>
  request(`/social/users/${encodeURIComponent(username)}/follow`, {
    method: "POST",
  });

export const unfollowUser = (username: string): Promise<RelationshipDto> =>
  request(`/social/users/${encodeURIComponent(username)}/follow`, {
    method: "DELETE",
  });

export const blockUser = (username: string): Promise<RelationshipDto> =>
  request(`/social/users/${encodeURIComponent(username)}/block`, {
    method: "POST",
  });

export const unblockUser = (username: string): Promise<RelationshipDto> =>
  request(`/social/users/${encodeURIComponent(username)}/block`, {
    method: "DELETE",
  });

export const getFollowRequests = (): Promise<FollowRequestDto[]> =>
  request("/social/requests");

export const acceptFollowRequest = (id: string): Promise<void> =>
  request(`/social/requests/${id}/accept`, { method: "POST" });

export const rejectFollowRequest = (id: string): Promise<void> =>
  request(`/social/requests/${id}/reject`, { method: "POST" });

export const getUserFollowers = (username: string): Promise<UserSummaryDto[]> =>
  request(`/social/users/${encodeURIComponent(username)}/followers`);

export const getUserFollowing = (username: string): Promise<UserSummaryDto[]> =>
  request(`/social/users/${encodeURIComponent(username)}/following`);

export const getPrivacySettings = (): Promise<VisibilitySettingsDto> =>
  request("/social/me/privacy");

export const updatePrivacySettings = (
  body: UpdateVisibilitySettingsDto,
): Promise<VisibilitySettingsDto> =>
  request("/social/me/privacy", { method: "PATCH", body });

/** Live counts of what switching to Figurant mode would immediately clean up. */
export const getGhostSwitchImpact = (): Promise<GhostSwitchImpactDto> =>
  request("/social/me/privacy/ghost-impact");
