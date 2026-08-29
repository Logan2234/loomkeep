import type {
  NotificationFeedDto,
  PushPublicKeyDto,
  PushSubscriptionRequestDto,
} from "@loomkeep/shared";
import { request } from "./core";

// --- Notifications ---

/** Detect new episodes of tracked shows, then return the refreshed feed. */
export const scanNotifications = (): Promise<NotificationFeedDto> =>
  request("/notifications/scan", { method: "POST" });

export const getNotifications = (): Promise<NotificationFeedDto> =>
  request("/notifications");

export const markNotificationsRead = (): Promise<void> =>
  request("/notifications/read", { method: "POST" });

export const markNotificationRead = (id: string): Promise<void> =>
  request(`/notifications/${id}/read`, { method: "PATCH" });

// --- Web Push ---

/** VAPID public key; empty string when the server has push disabled. */
export const getPushPublicKey = (): Promise<PushPublicKeyDto> =>
  request("/notifications/push/public-key", { withAuth: false });

export const subscribePush = (
  body: PushSubscriptionRequestDto,
): Promise<void> =>
  request("/notifications/push/subscribe", { method: "POST", body });

export const unsubscribePush = (endpoint: string): Promise<void> =>
  request("/notifications/push/subscribe", {
    method: "DELETE",
    body: { endpoint },
  });
