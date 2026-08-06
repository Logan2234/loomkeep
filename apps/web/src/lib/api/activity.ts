import type { ActivityEventDto, ActivityFeedDto } from "@loomkeep/shared";
import { request } from "./core";

/** Home feed: the users you follow, paginated by opaque cursor. */
export function getFeed(cursor?: string): Promise<ActivityFeedDto> {
  const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  return request(`/social/feed${qs}`);
}

/** Short home-page teaser of the home feed. */
export function getFeedPreview(): Promise<ActivityEventDto[]> {
  return request("/social/feed/preview");
}

/** A user's detailed activity timeline (visibility-filtered). */
export function getUserActivity(
  username: string,
  cursor?: string,
): Promise<ActivityFeedDto> {
  const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  return request(`/social/users/${encodeURIComponent(username)}/activity${qs}`);
}
