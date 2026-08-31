import { typedRequest } from "./generated/typed-request";

/** Home feed: the users you follow, paginated. */
export const getFeed = (page = 1) =>
  typedRequest("/social/feed", { query: { page: String(page) } });

/** Short home-page teaser of the home feed. */
export const getFeedPreview = () => typedRequest("/social/feed/preview");

/** A user's detailed activity timeline (visibility-filtered). */
export function getUserActivity(username: string, page = 1) {
  return typedRequest("/social/users/{username}/activity", {
    params: { username },
    query: { page: String(page) },
  });
}
