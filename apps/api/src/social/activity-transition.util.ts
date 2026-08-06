import { ActivityType, type Domain } from "@loomkeep/shared";

/**
 * The role a domain status plays in the shared lifecycle. Each domain's status
 * enum maps onto these four so one transition rule fits all of them.
 */
type StatusRole = "planned" | "started" | "completed" | "dropped";

const STATUS_ROLE: Record<string, Record<string, StatusRole>> = {
  MEDIA: {
    PLANNED: "planned",
    WATCHING: "started",
    COMPLETED: "completed",
    UP_TO_DATE: "completed",
    DROPPED: "dropped",
  },
  GAMES: {
    BACKLOG: "planned",
    PLAYING: "started",
    COMPLETED: "completed",
    DROPPED: "dropped",
  },
  BOOKS: {
    TO_READ: "planned",
    READING: "started",
    READ: "completed",
    DROPPED: "dropped",
  },
  MUSIC: {
    TO_LISTEN: "planned",
    LISTENED: "completed",
  },
};

export interface ActivityTransition {
  type: ActivityType;
  /** Whether it surfaces on followers' home feed (matrix milestone). */
  homeFeed: boolean;
}

/**
 * Classifies a library status change into the activity event it should emit, or
 * null when it's not feed-worthy. Pure, so the matrix rules are unit-testable.
 *
 * - New entry (`prev` null): FINISHED/STARTED when added straight as
 *   completed/started, else ADDED (planned/backlog — profile-only).
 * - Existing entry: emit the milestone only when the *role* actually changes,
 *   so idle patches (notes, ownership…) stay silent.
 *
 * Home-feed flags follow the plan's matrix: STARTED/FINISHED reach the home
 * feed; ADDED and DROPPED stay on the profile timeline.
 */
export function classifyStatusTransition(
  domain: Domain,
  prev: string | null,
  next: string,
): ActivityTransition | null {
  const roles = STATUS_ROLE[domain];
  if (!roles) return null;

  const nextRole = roles[next];
  if (!nextRole) return null;
  const prevRole = prev ? (roles[prev] ?? null) : null;

  if (prev === null) {
    if (nextRole === "completed") {
      return { type: ActivityType.FINISHED, homeFeed: true };
    }

    if (nextRole === "started") {
      return { type: ActivityType.STARTED, homeFeed: true };
    }

    return { type: ActivityType.ADDED, homeFeed: false };
  }

  if (nextRole === prevRole) return null;

  switch (nextRole) {
    case "started":
      return { type: ActivityType.STARTED, homeFeed: true };
    case "completed":
      return { type: ActivityType.FINISHED, homeFeed: true };
    case "dropped":
      return { type: ActivityType.DROPPED, homeFeed: false };
    default:
      return null;
  }
}
