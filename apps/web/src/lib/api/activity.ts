import type { Domain } from "@loomkeep/shared";
import { typedRequest } from "./generated/typed-request";

/** `domain` narrows the feed to one of the viewer's enabled domains. */
export const getFeed = (page = 1, domain?: Domain) =>
  typedRequest("/social/feed", {
    query: { page: String(page), ...(domain ? { domain } : {}) },
  });

export const getFeedPreview = () => typedRequest("/social/feed/preview");

export function getUserActivity(username: string, page = 1) {
  return typedRequest("/social/users/{username}/activity", {
    params: { username },
    query: { page: String(page) },
  });
}
