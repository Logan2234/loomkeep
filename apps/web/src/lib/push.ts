import { getPushPublicKey, subscribePush, unsubscribePush } from "./api/client";

/** Web Push is only available with a service worker and the Push API. */
export const isPushSupported = (): boolean =>
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window;

// VAPID keys are base64url; PushManager wants a Uint8Array over a real
// ArrayBuffer (not the ArrayBufferLike that Uint8Array.from infers).
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const buffer = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) buffer[i] = raw.charCodeAt(i);
  return buffer;
}

/**
 * Requests notification permission, subscribes this device to Web Push and
 * registers it with the API. Returns false if unsupported, denied, or the
 * server has push disabled (no VAPID key).
 */
export async function enablePush(): Promise<boolean> {
  if (!isPushSupported()) return false;

  const { publicKey } = await getPushPublicKey();
  if (!publicKey) return false;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return false;

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });

  const json = subscription.toJSON();
  await subscribePush({
    endpoint: subscription.endpoint,
    keys: {
      p256dh: json.keys?.p256dh ?? "",
      auth: json.keys?.auth ?? "",
    },
  });
  return true;
}

/** Unsubscribes this device locally and on the API. */
export async function disablePush(): Promise<void> {
  if (!isPushSupported()) return;

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  await unsubscribePush(subscription.endpoint).catch(() => undefined);
  await subscription.unsubscribe();
}
