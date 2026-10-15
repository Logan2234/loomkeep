import { resolveApiError } from "#lib/api/errors.js";
import { keys } from "#lib/api/keys.js";
import {
  deleteNotification,
  markNotificationRead,
  markNotificationsRead,
  markNotificationsSeen,
  markNotificationUnread,
} from "#lib/api/notifications.js";
import { m } from "#lib/paraglide/messages.js";
import { toast } from "#lib/toast.svelte.js";
import type { NotificationCountsDto, NotificationDto } from "@loomkeep/shared";
import type { QueryClient } from "@tanstack/svelte-query";
import { type EntriesData, mapEntries } from "./cache";

/** How long a read entry stays in the unread list, so its dot is seen going out. */
const LEAVE_DELAY_MS = 260;
/** "Mark all read" puts out the dots one after the other, this far apart. */
export const CASCADE_STEP_MS = 35;
const UNDO_MS = 5000;

/** While true, rows stagger their read transition by their position. */
export const cascade = $state({ on: false });

/**
 * What the bell and the notifications page do to an entry. Every change
 * shows at once in both (the caches are patched before the server answers),
 * which is what lets the dots fade and the rows leave as the click lands.
 */
export function notificationActions(queryClient: QueryClient) {
  function patch(fn: (entry: NotificationDto) => NotificationDto | null) {
    queryClient.setQueriesData<EntriesData>(
      {
        queryKey: keys.notifications.entries(),
        predicate: (query) => query.queryKey[2] !== "counts",
      },
      (data) => mapEntries(data, fn),
    );
  }

  function patchCounts(
    fn: (counts: NotificationCountsDto) => NotificationCountsDto,
  ) {
    queryClient.setQueryData<NotificationCountsDto>(
      keys.notifications.counts(),
      (counts) => counts && fn(counts),
    );
  }

  /** The unread list lets go of what was just read, once its dot is out. */
  function dropReadLater(delay: number) {
    setTimeout(() => {
      queryClient.setQueriesData<EntriesData>(
        { queryKey: keys.notifications.history(true) },
        (data) => mapEntries(data, (entry) => (entry.readAt ? null : entry)),
      );
    }, delay);
  }

  function refreshCounts() {
    void queryClient.invalidateQueries({
      queryKey: keys.notifications.counts(),
    });
  }

  function fail(err: unknown) {
    toast.error(resolveApiError(err));
    void queryClient.invalidateQueries({
      queryKey: keys.notifications.entries(),
    });
  }

  function setRead(entry: NotificationDto, read: boolean) {
    if ((entry.readAt !== null) === read) return;
    const readAt = read ? new Date().toISOString() : null;
    patch((e) => (e.id === entry.id ? { ...e, readAt } : e));
    patchCounts((c) => ({
      ...c,
      unread: Math.max(0, c.unread + (read ? -1 : 1)),
    }));
    if (read) dropReadLater(LEAVE_DELAY_MS);
    (read ? markNotificationRead : markNotificationUnread)(entry.id).then(
      refreshCounts,
      fail,
    );
  }

  return {
    read: (entry: NotificationDto) => setRead(entry, true),
    unread: (entry: NotificationDto) => setRead(entry, false),

    /** `shown`: how many rows are on screen, which the cascade runs down. */
    readAll(shown: number) {
      const readAt = new Date().toISOString();
      cascade.on = true;
      patch((e) => (e.readAt ? e : { ...e, readAt }));
      patchCounts((c) => ({ ...c, unread: 0, unseen: 0 }));
      // The unread list's rows leave staggered too, each once its dot is out.
      dropReadLater(LEAVE_DELAY_MS);
      setTimeout(
        () => (cascade.on = false),
        LEAVE_DELAY_MS + shown * CASCADE_STEP_MS,
      );
      markNotificationsRead().then(refreshCounts, fail);
    },

    /**
     * Taken off at once, deleted for good when the toast leaves: "Annuler"
     * only has to bring the entry back, with no route to restore one.
     */
    remove(entry: NotificationDto) {
      let undone = false;
      patch((e) => (e.id === entry.id ? null : e));

      if (!entry.readAt) {
        patchCounts((c) => ({ ...c, unread: Math.max(0, c.unread - 1) }));
      }

      toast.show(
        m.notif_deleted(),
        "info",
        UNDO_MS,
        [{ label: m.common_undo(), onSelect: () => (undone = true) }],
        () => {
          if (undone) {
            void queryClient.invalidateQueries({
              queryKey: keys.notifications.entries(),
            });
            return;
          }

          deleteNotification(entry.id).then(refreshCounts, fail);
        },
      );
    },

    /**
     * A push opened from the system tray: its entry is read, wherever it is
     * (it may not be loaded, or may be gone, which needs no telling).
     */
    openedFromPush(id: string) {
      const readAt = new Date().toISOString();
      patch((e) => (e.id === id && !e.readAt ? { ...e, readAt } : e));
      markNotificationRead(id)
        .catch(() => {})
        .finally(() =>
          queryClient.invalidateQueries({
            queryKey: keys.notifications.entries(),
          }),
        );
    },

    /** The bell or the page was opened: the badge starts over. */
    seen() {
      patchCounts((c) => ({ ...c, unseen: 0 }));
      markNotificationsSeen().then(refreshCounts, refreshCounts);
    },
  };
}
