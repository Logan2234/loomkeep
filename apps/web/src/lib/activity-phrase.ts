import { m } from "#lib/paraglide/messages.js";
import type { ActivityEventDto } from "@loomkeep/shared";

/**
 * Localized action phrase for an activity event. PROGRESS/LIST_ITEM_ADDED
 * use their aggregated count. Shared between `ActivityItem` (feed, home
 * preview) and the profile page's own timeline presentation, so the two
 * never drift on wording.
 */
export function activityPhrase(e: ActivityEventDto): string {
  switch (e.type) {
    case "ADDED":
      return m.activity_added();
    case "STARTED":
      return m.activity_started();
    case "FINISHED":
      return m.activity_finished();
    case "DROPPED":
      return m.activity_dropped();
    case "REWATCHED":
      return m.activity_rewatched();
    case "FAVORITED":
      return m.activity_favorited();
    case "REVIEWED":
      return m.activity_reviewed();
    case "PROGRESS":
      if (e.domain === "GAMES" && typeof e.data.durationMinutes === "number") {
        return e.count > 1
          ? m.activity_game_sessions({ count: e.count })
          : m.activity_game_session({ minutes: e.data.durationMinutes });
      }

      if (e.domain === "BOOKS" && typeof e.data.pagesRead === "number") {
        return e.count > 1
          ? m.activity_book_sessions({ count: e.count })
          : m.activity_book_session({ pages: e.data.pagesRead });
      }

      return e.count > 1
        ? m.activity_progress_count({ count: e.count })
        : m.activity_progress();
    case "LIST_CREATED":
      return m.activity_list_created();
    case "LIST_ITEM_ADDED":
      return e.count > 1
        ? m.activity_list_item_added_count({ count: e.count })
        : m.activity_list_item_added();
    case "LIST_SHARED":
      return m.activity_list_shared();
    case "SEASON_FINISHED":
      return typeof e.data.seasonNumber === "number"
        ? m.activity_season_finished({ season: e.data.seasonNumber })
        : m.activity_finished();
    default:
      return m.activity_updated();
  }
}

export function activityRating(e: ActivityEventDto): number | null {
  return e.type === "REVIEWED" && typeof e.data.rating === "number"
    ? e.data.rating
    : null;
}
