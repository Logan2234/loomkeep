import type { ActivityEventDto, PagedResult } from "@loomkeep/shared";
import { request } from "./core";
import { typedRequest } from "./generated/typed-request";

// Not migrated: query-string params aren't supported by typedRequest yet.
/** Home feed: the users you follow, paginated. */
export const getFeed = (page = 1): Promise<PagedResult<ActivityEventDto>> =>
  request(`/social/feed?${new URLSearchParams({ page: String(page) })}`);

/** Short home-page teaser of the home feed. */
export const getFeedPreview = () => typedRequest("/social/feed/preview");

// Not migrated: query-string params aren't supported by typedRequest yet.
/** A user's detailed activity timeline (visibility-filtered). */
export function getUserActivity(
  username: string,
  page = 1,
): Promise<PagedResult<ActivityEventDto>> {
  const params = new URLSearchParams({ page: String(page) });
  return request(
    `/social/users/${encodeURIComponent(username)}/activity?${params}`,
  );
}
