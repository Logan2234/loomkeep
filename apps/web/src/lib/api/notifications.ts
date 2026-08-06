import type {
  NotificationFeedDto,
  PushPublicKeyDto,
  PushSubscriptionRequestDto,
} from "@loomkeep/shared";
import { request } from "./core";

// --- Notifications ---

/** Detect new episodes of tracked shows, then return the refreshed feed. */
export function scanNotifications(): Promise<NotificationFeedDto> {
  return request("/notifications/scan", { method: "POST" });
}

export function getNotifications(): Promise<NotificationFeedDto> {
  return request("/notifications");
}

export function markNotificationsRead(): Promise<void> {
  return request("/notifications/read", { method: "POST" });
}

export function markNotificationRead(id: string): Promise<void> {
  return request(`/notifications/${id}/read`, { method: "PATCH" });
}

// --- Web Push ---

/** VAPID public key; empty string when the server has push disabled. */
export function getPushPublicKey(): Promise<PushPublicKeyDto> {
  return request("/notifications/push/public-key", { withAuth: false });
}

export function subscribePush(body: PushSubscriptionRequestDto): Promise<void> {
  return request("/notifications/push/subscribe", { method: "POST", body });
}

export function unsubscribePush(endpoint: string): Promise<void> {
  return request("/notifications/push/subscribe", {
    method: "DELETE",
    body: { endpoint },
  });
}
