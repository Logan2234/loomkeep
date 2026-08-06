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

export function getProfile(username: string): Promise<SocialProfileDto> {
  return request(`/social/users/${encodeURIComponent(username)}`);
}

export function followUser(username: string): Promise<RelationshipDto> {
  return request(`/social/users/${encodeURIComponent(username)}/follow`, {
    method: "POST",
  });
}

export function unfollowUser(username: string): Promise<RelationshipDto> {
  return request(`/social/users/${encodeURIComponent(username)}/follow`, {
    method: "DELETE",
  });
}

export function blockUser(username: string): Promise<RelationshipDto> {
  return request(`/social/users/${encodeURIComponent(username)}/block`, {
    method: "POST",
  });
}

export function unblockUser(username: string): Promise<RelationshipDto> {
  return request(`/social/users/${encodeURIComponent(username)}/block`, {
    method: "DELETE",
  });
}

export function getFollowRequests(): Promise<FollowRequestDto[]> {
  return request("/social/requests");
}

export function acceptFollowRequest(id: string): Promise<void> {
  return request(`/social/requests/${id}/accept`, { method: "POST" });
}

export function rejectFollowRequest(id: string): Promise<void> {
  return request(`/social/requests/${id}/reject`, { method: "POST" });
}

export function getUserFollowers(username: string): Promise<UserSummaryDto[]> {
  return request(`/social/users/${encodeURIComponent(username)}/followers`);
}

export function getUserFollowing(username: string): Promise<UserSummaryDto[]> {
  return request(`/social/users/${encodeURIComponent(username)}/following`);
}

export function getPrivacySettings(): Promise<VisibilitySettingsDto> {
  return request("/social/me/privacy");
}

export function updatePrivacySettings(
  body: UpdateVisibilitySettingsDto,
): Promise<VisibilitySettingsDto> {
  return request("/social/me/privacy", { method: "PATCH", body });
}

/** Live counts of what switching to Figurant mode would immediately clean up. */
export function getGhostSwitchImpact(): Promise<GhostSwitchImpactDto> {
  return request("/social/me/privacy/ghost-impact");
}
