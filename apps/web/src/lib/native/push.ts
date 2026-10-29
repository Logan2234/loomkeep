import { subscribeNativePush, unsubscribeNativePush } from "#lib/api/client.js";
import { STORAGE_KEYS } from "#lib/constants/storage-keys.js";
import {
  readStorage,
  removeStorage,
  writeStorage,
} from "#lib/local-storage.js";
import { m } from "#lib/paraglide/messages.js";
import { goto } from "$app/navigation";
import { Capacitor } from "@capacitor/core";
import {
  type ActionPerformed,
  PushNotifications,
} from "@capacitor/push-notifications";
import { AlertGroup } from "@loomkeep/shared";

/**
 * Whether this build of the Android app can receive push: apps/mobile
 * leaves the plugin out of a build made without Firebase's config, where
 * registering would crash the app.
 */
export const isNativePushAvailable = (): boolean =>
  Capacitor.isPluginAvailable("PushNotifications");

/**
 * Whether the APK draws its notifications itself, with buttons (MOB-17):
 * the API then sends it data-only messages, which an older APK wouldn't show.
 */
const drawsOwnNotifications = (): boolean =>
  Capacitor.isPluginAvailable("NotificationActions");

// Android notification importance: 4 pops up on screen, 3 only sounds.
const CHANNELS: Record<AlertGroup, { name: () => string; importance: 3 | 4 }> =
  {
    [AlertGroup.ACTIVITY]: { name: m.common_activity, importance: 4 },
    [AlertGroup.RELEASES]: { name: m.push_channel_releases, importance: 3 },
    [AlertGroup.ACCOUNT]: { name: m.common_account, importance: 3 },
    [AlertGroup.SECURITY]: { name: m.common_security, importance: 4 },
    [AlertGroup.ADMIN]: { name: m.common_admin, importance: 3 },
    [AlertGroup.ANNOUNCEMENTS]: {
      name: m.push_channel_announcements,
      importance: 3,
    },
  };

/**
 * One Android notification channel per ALERTS group (the API sends each
 * push on its group's), so each can be muted from Android's settings.
 * Recreating them only renames them, into the current language.
 */
async function createChannels(): Promise<void> {
  await Promise.all(
    Object.entries(CHANNELS).map(([id, { name, importance }]) =>
      PushNotifications.createChannel({ id, name: name(), importance }),
    ),
  );
}

/** The page a tapped notification opens; `notification` marks its bell entry read. */
export function notificationTarget({
  url = "/app",
  notificationId,
}: {
  url?: string;
  notificationId?: string;
}): string {
  if (!notificationId) return url;
  const target = new URL(url, "https://loomkeep.invalid");
  target.searchParams.set("notification", notificationId);
  return target.pathname + target.search + target.hash;
}

function openNotification({ notification }: ActionPerformed): void {
  void goto(notificationTarget(notification.data ?? {}));
}

/** Resolves with the FCM token `register()` hands out, through its events. */
function requestToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    const listeners = [
      PushNotifications.addListener("registration", ({ value }) => {
        stop();
        resolve(value);
      }),
      PushNotifications.addListener("registrationError", ({ error }) => {
        stop();
        reject(new Error(error));
      }),
    ];
    const stop = () =>
      listeners.forEach((listener) => void listener.then((l) => l.remove()));
    void PushNotifications.register();
  });
}

/** Asks Android's permission, then registers this install with the API. */
export async function enableNativePush(): Promise<boolean> {
  const { receive } = await PushNotifications.requestPermissions();
  if (receive !== "granted") return false;

  const token = await requestToken();
  await subscribeNativePush(token, drawsOwnNotifications());
  writeStorage(STORAGE_KEYS.nativePushToken, token);
  return true;
}

export async function isNativePushEnabledHere(): Promise<boolean> {
  const { receive } = await PushNotifications.checkPermissions();
  return (
    receive === "granted" && readStorage(STORAGE_KEYS.nativePushToken) !== null
  );
}

export async function disableNativePush(): Promise<void> {
  const token = readStorage(STORAGE_KEYS.nativePushToken);
  if (token) await unsubscribeNativePush(token).catch(() => undefined);
  removeStorage(STORAGE_KEYS.nativePushToken);
  await PushNotifications.unregister();
}

/**
 * FCM rotates a token now and then: the new one replaces the old on the
 * API, as long as push is on here.
 */
async function replaceToken({ value }: { value: string }): Promise<void> {
  const previous = readStorage(STORAGE_KEYS.nativePushToken);
  if (!previous || previous === value) return;

  await subscribeNativePush(value, drawsOwnNotifications());
  writeStorage(STORAGE_KEYS.nativePushToken, value);
  await unsubscribeNativePush(previous).catch(() => undefined);
}

/** Wires push in the app shell; returns the teardown for its `$effect`. */
export function startNativePush(): () => void {
  void createChannels();
  // Said again at each start: an updated APK (or an older one put back)
  // changes what the API may send this device.
  const token = readStorage(STORAGE_KEYS.nativePushToken);

  if (token) {
    void subscribeNativePush(token, drawsOwnNotifications()).catch(
      () => undefined,
    );
  }

  const listeners = [
    // Also delivers the tap that cold-started the app, held until now.
    PushNotifications.addListener(
      "pushNotificationActionPerformed",
      openNotification,
    ),
    PushNotifications.addListener("registration", replaceToken),
  ];
  return () =>
    listeners.forEach((listener) => void listener.then((l) => l.remove()));
}
