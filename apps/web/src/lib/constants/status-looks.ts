import type { IconName } from "#lib/types/icon-name.js";

export type StatusTone = "idle" | "active" | "done" | "dropped";

/**
 * How each domain's statuses read at a glance: to do, under way, done or
 * dropped — the status badge's colours, the friends' columns on a work.
 */
export const STATUS_LOOKS: Record<
  "MEDIA" | "BOOKS" | "GAMES" | "MUSIC",
  Record<string, { tone: StatusTone; icon: IconName }>
> = {
  MEDIA: {
    PLANNED: { tone: "idle", icon: "tv" },
    WATCHING: { tone: "active", icon: "play" },
    UP_TO_DATE: { tone: "done", icon: "calendar" },
    COMPLETED: { tone: "done", icon: "check" },
    DROPPED: { tone: "dropped", icon: "x" },
  },
  BOOKS: {
    TO_READ: { tone: "idle", icon: "book" },
    READING: { tone: "active", icon: "book-open" },
    READ: { tone: "done", icon: "check" },
    DROPPED: { tone: "dropped", icon: "x" },
  },
  GAMES: {
    BACKLOG: { tone: "idle", icon: "gamepad" },
    PLAYING: { tone: "active", icon: "play" },
    COMPLETED: { tone: "done", icon: "check" },
    DROPPED: { tone: "dropped", icon: "x" },
  },
  MUSIC: {
    TO_LISTEN: { tone: "idle", icon: "music" },
    LISTENED: { tone: "done", icon: "check" },
  },
};
