import type { PushSubscriptionRequestDto } from "@loomkeep/shared";
import { typedRequest } from "./generated/typed-request";

// --- Notifications ---

/** Detect new episodes of tracked shows, then return the refreshed feed. */
export const scanNotifications = () =>
  typedRequest("/notifications/scan", { method: "POST" });

export const getNotifications = () => typedRequest("/notifications");

export const markNotificationsRead = (): Promise<void> =>
  typedRequest("/notifications/read", { method: "POST" });

export const markNotificationRead = (id: string): Promise<void> =>
  typedRequest("/notifications/{id}/read", { method: "PATCH", params: { id } });

// --- Web Push ---

/** VAPID public key; empty string when the server has push disabled. */
export const getPushPublicKey = () =>
  typedRequest("/notifications/push/public-key", { withAuth: false });

export const subscribePush = (
  body: PushSubscriptionRequestDto,
): Promise<void> =>
  typedRequest("/notifications/push/subscribe", { method: "POST", body });

export const unsubscribePush = (endpoint: string): Promise<void> =>
  typedRequest("/notifications/push/subscribe", {
    method: "DELETE",
    body: { endpoint },
  });
