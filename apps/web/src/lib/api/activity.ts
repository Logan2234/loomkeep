import { typedRequest } from "./generated/typed-request";

export const getFeed = (page = 1) =>
  typedRequest("/social/feed", { query: { page: String(page) } });

export const getFeedPreview = () => typedRequest("/social/feed/preview");

export function getUserActivity(username: string, page = 1) {
  return typedRequest("/social/users/{username}/activity", {
    params: { username },
    query: { page: String(page) },
  });
}
