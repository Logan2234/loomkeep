export const REPORT_THROTTLE = { default: { limit: 1, ttl: 5_000 } };
export const EXPORT_THROTTLE = { default: { limit: 10, ttl: 3_600_000 } };
export const SENSITIVE_ACTION_THROTTLE = { default: { limit: 5, ttl: 60_000 } };
// Between friends a flood is unlikely, but one account can still script it.
export const CHAT_MESSAGE_THROTTLE = { default: { limit: 30, ttl: 60_000 } };
// Each search asks up to five catalogues, two of them queued instance-wide.
export const WORK_SEARCH_THROTTLE = { default: { limit: 60, ttl: 60_000 } };
// A home-screen widget checks off episodes one tap at a time, a few in a row at most.
export const HOME_SCREEN_WIDGET_THROTTLE = {
  default: { limit: 30, ttl: 60_000 },
};
