import type { PushSubscriptionRequestDto } from "@loomkeep/shared";
import { typedRequest } from "./generated/typed-request";

/** Looks for new releases now: they go out by push and email, not the bell. */
export const scanNotifications = () =>
  typedRequest("/notifications/scan", { method: "POST" });

/** Every entry still kept, newest first; `unread` keeps the unread ones. */
export const getNotificationHistory = (
  page = 1,
  { unread = false, limit }: { unread?: boolean; limit?: number } = {},
) =>
  typedRequest("/notifications/history", {
    query: {
      page: String(page),
      ...(limit ? { limit: String(limit) } : {}),
      ...(unread ? { unread: "true" } : {}),
    },
  });

export const getNotificationCounts = () =>
  typedRequest("/notifications/counts");

/** The bell or the page was opened: what's there is no longer new. */
export const markNotificationsSeen = (): Promise<void> =>
  typedRequest("/notifications/seen", { method: "POST" });

export const markNotificationsRead = (): Promise<void> =>
  typedRequest("/notifications/read", { method: "POST" });

export const markNotificationRead = (id: string): Promise<void> =>
  typedRequest("/notifications/{id}/read", { method: "PATCH", params: { id } });

export const markNotificationUnread = (id: string): Promise<void> =>
  typedRequest("/notifications/{id}/unread", {
    method: "PATCH",
    params: { id },
  });

export const deleteNotification = (id: string): Promise<void> =>
  typedRequest("/notifications/{id}", { method: "DELETE", params: { id } });

/** VAPID public key; empty string when the server has push disabled. */
export const getPushPublicKey = () =>
  typedRequest("/notifications/push/public-key", { withAuth: false });

/** How many of the account's devices receive push. */
export const getPushDeviceCount = () =>
  typedRequest("/notifications/push/devices/count");

export const subscribePush = (
  body: PushSubscriptionRequestDto,
): Promise<void> =>
  typedRequest("/notifications/push/subscribe", { method: "POST", body });

export const unsubscribePush = (endpoint: string): Promise<void> =>
  typedRequest("/notifications/push/subscribe", {
    method: "DELETE",
    body: { endpoint },
  });

/** The Android app's FCM registration token. */
export const subscribeNativePush = (
  token: string,
  actions: boolean,
): Promise<void> =>
  typedRequest("/notifications/push/native", {
    method: "POST",
    body: { token, actions },
  });

export const unsubscribeNativePush = (token: string): Promise<void> =>
  typedRequest("/notifications/push/native", {
    method: "DELETE",
    body: { token },
  });

/** What the Android app's home-screen widgets (MOB-20) send instead of a session. */
export const getHomeScreenWidgetToken = () =>
  typedRequest("/home-screen-widgets/token", { method: "POST" });
