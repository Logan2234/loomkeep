import {
  getNotifications,
  markNotificationRead,
  markNotificationsRead,
  scanNotifications,
} from "$lib/api/client";
import type { NotificationDto } from "@loomkeep/shared";

/** In-app notification feed + unread count, shared across the app (rune store). */
class Notifications {
  items = $state<NotificationDto[]>([]);
  unread = $state(0);

  /** Refresh the feed; `scan` also detects new episodes server-side first. */
  async refresh(scan = false): Promise<void> {
    try {
      const feed = scan ? await scanNotifications() : await getNotifications();
      this.items = feed.notifications;
      this.unread = feed.unread;
    } catch {
      // Best-effort; leave current state on error.
    }
  }

  // Reading a notification deletes it server-side, so "read" means "gone" —
  // there's no dimmed/read-but-visible state.
  async markAllRead(): Promise<void> {
    if (this.items.length === 0) return;

    try {
      await markNotificationsRead();
      this.items = [];
      this.unread = 0;
    } catch {
      // ignore
    }
  }

  async markRead(id: string): Promise<void> {
    if (!this.items.some((n) => n.id === id)) return;

    try {
      await markNotificationRead(id);
      this.items = this.items.filter((n) => n.id !== id);
      this.unread = this.items.length;
    } catch {
      // ignore
    }
  }
}

export const notifications = new Notifications();
