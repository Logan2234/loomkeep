/**
 * One in-app notification. Kinds share a generic shape; `type` disambiguates
 * how the client renders it ("NEW_EPISODE", "FOLLOW", "FOLLOW_REQUEST",
 * "FOLLOW_ACCEPTED"…).
 */
export interface NotificationDto {
  id: string;
  type: string;
  /** Primary line (media title, or the social actor's display name). */
  title: string;
  /** Secondary line (e.g. "S1E2 · Title", "vous suit"). */
  body: string | null;
  /** Client deep link, or null when the notification isn't navigable. */
  url: string | null;
  /**
   * Kind-specific display extras. NEW_EPISODE: `{ airDate }`. Social kinds:
   * `{ actorUsername, actorDisplayName }` (drives the Avatar in the feed).
   */
  data: Record<string, unknown>;
  /** ISO timestamp to display: the episode air date, else `createdAt`. */
  timestamp: string;
  /** ISO creation date (when the row was written). */
  createdAt: string;
}

export interface NotificationFeedDto {
  notifications: NotificationDto[];
  /** Count of unread notifications. */
  unread: number;
}
