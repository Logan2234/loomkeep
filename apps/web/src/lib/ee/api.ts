import { typedRequest } from "$lib/api/generated/typed-request";

export const getEeStatus = () => typedRequest("/ee/status");

// Creates the token on first call.
export const getCalendarToken = () => typedRequest("/users/me/calendar-token");

export const regenerateCalendarToken = () =>
  typedRequest("/users/me/calendar-token/regenerate", { method: "POST" });

// Creates the token on first call.
export const getActivityFeedToken = () =>
  typedRequest("/users/me/activity-feed-token");

export const regenerateActivityFeedToken = () =>
  typedRequest("/users/me/activity-feed-token/regenerate", {
    method: "POST",
  });
