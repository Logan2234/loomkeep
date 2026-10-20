/// <reference lib="webworker" />
import { version } from "$app/env";
import { assets, immutable, prerendered } from "$app/manifest";
import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching";

declare let self: ServiceWorkerGlobalScope;

precacheAndRoute([
  ...immutable.map(({ path }) => ({ url: path, revision: null })),
  ...[...assets, ...prerendered].map(({ path }) => ({
    url: path || "/",
    revision: version,
  })),
]);
cleanupOutdatedCaches();

self.skipWaiting();
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

interface PushPayload {
  title: string;
  body: string;
  url: string;
  /** Language of the server-generated text, when provided by the sender. */
  locale?: string;
  /** Pushes sharing a tag replace each other, e.g. one per conversation. */
  tag?: string;
  /** The bell entry it announces: opening the push marks it read. */
  notificationId?: string;
  /** What the installed app's icon badge shows now. */
  badge?: number;
}

// A push from the API: show a notification carrying the deep link.
self.addEventListener("push", (event) => {
  if (!event.data) return;
  const payload = event.data.json() as PushPayload;

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(payload.title, {
        body: payload.body,
        icon: "/favicon.svg",
        badge: "/favicon.svg",
        data: { url: openUrl(payload) },
        dir: "auto",
        lang: payload.locale,
        tag: payload.tag ?? "loomkeep",
      }),
      // While the app is closed, only a push can bring the icon up to date.
      updateAppBadge(payload.badge),
    ]),
  );
});

/** The app reads `notification` on arrival, marks that entry read and drops it. */
function openUrl({ url, notificationId }: PushPayload): string {
  if (!notificationId) return url;
  const target = new URL(url, self.location.origin);
  target.searchParams.set("notification", notificationId);
  return target.pathname + target.search + target.hash;
}

async function updateAppBadge(count: number | undefined): Promise<void> {
  if (count === undefined) return;
  const nav = self.navigator as WorkerNavigator & {
    setAppBadge?: (count?: number) => Promise<void>;
    clearAppBadge?: () => Promise<void>;
  };
  try {
    await (count > 0 ? nav.setAppBadge?.(count) : nav.clearAppBadge?.());
  } catch {
    // Not installed, or no badge on this platform.
  }
}

// Focus an existing tab if the app is already open, otherwise open the link.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data as { url?: string })?.url ?? "/app";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        const existing = clients.find((c) => "focus" in c);
        if (existing) {
          void existing.focus();
          return (existing as WindowClient).navigate(url);
        }
        return self.clients.openWindow(url);
      }),
  );
});
