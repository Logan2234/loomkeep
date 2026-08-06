import type { NotificationDto } from "@loomkeep/shared";
import {
  getNotifications,
  markNotificationRead,
  markNotificationsRead,
  scanNotifications,
} from "$lib/api/client";

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

  async markAllRead(): Promise<void> {
    if (this.unread === 0) return;

    try {
      await markNotificationsRead();
      this.unread = 0;
      this.items = this.items.map((n) => ({ ...n, read: true }));
    } catch {
      // ignore
    }
  }

  async markRead(id: string): Promise<void> {
    const target = this.items.find((n) => n.id === id);
    if (!target || target.read) return;

    try {
      await markNotificationRead(id);
      target.read = true;
      this.unread = Math.max(0, this.unread - 1);
    } catch {
      // ignore
    }
  }
}

export const notifications = new Notifications();
