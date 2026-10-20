import type { LibrarySagaSort, SagaMemberDto } from "@loomkeep/shared";

type SagaProgress<M> =
  | {
      state: "inProgress" | "waiting";
      next: M;
      seen: number;
      released: number;
    }
  | { state: "finished"; next: null; seen: number; released: number }
  | { state: "none" };

/** How a domain reads its own statuses: what counts as seen, or dropped. */
export interface SagaStatusReader<M> {
  isSeen: (member: M) => boolean;
  isDropped: (member: M) => boolean;
  /** Announced, not out yet: never counted. Books are only ever catalogued once out. */
  isUpcoming?: (member: M) => boolean;
}

/** A film or an anime: one caught up on, still airing, counts as seen. */
export const MEDIA_SAGA_STATUS: SagaStatusReader<
  Pick<SagaMemberDto, "status" | "upcoming">
> = {
  isSeen: (m) => m.status === "COMPLETED" || m.status === "UP_TO_DATE",
  isDropped: (m) => m.status === "DROPPED",
  isUpcoming: (m) => m.upcoming,
};

/**
 * Where the viewer stands in a saga. In progress: a work finished and a
 * released one still to see — a dropped work isn't one. Waiting: everything
 * released seen (or dropped), with a sequel announced. Finished: the same
 * with nothing announced. A saga never started — or only ever dropped —
 * stays out of the view.
 */
export function sagaProgress<M>(
  members: M[],
  { isSeen, isDropped, isUpcoming = () => false }: SagaStatusReader<M>,
): SagaProgress<M> {
  const released = members.filter((m) => !isUpcoming(m));
  const seen = released.filter(isSeen).length;
  if (seen === 0) return { state: "none" };

  const counts = { seen, released: released.length };
  const toSee = released.find((m) => !isSeen(m) && !isDropped(m));
  if (toSee) return { state: "inProgress", next: toSee, ...counts };

  const announced = members.find(isUpcoming);
  return announced
    ? { state: "waiting", next: announced, ...counts }
    : { state: "finished", next: null, ...counts };
}

/**
 * How many released works a saga counts once it is completed — every one of
 * them seen, none dropped, nothing announced — or null while it isn't. What
 * SAGA_COMPLETED is paid on.
 */
export function completedSagaWorks<M>(
  members: M[],
  reader: SagaStatusReader<M>,
): number | null {
  const progress = sagaProgress(members, reader);
  return progress.state === "finished" && progress.seen === progress.released
    ? progress.released
    : null;
}

/** What sorting reads of a saga, whatever its domain. */
type SagaRanked = {
  title: string;
  seen: number;
  released: number;
  lastActivityAt: string;
};

/** Descending by default: most recent, Z to A, furthest along first. */
export function sagaComparator(
  sort: LibrarySagaSort,
): (a: SagaRanked, b: SagaRanked) => number {
  switch (sort) {
    case "title":
      return (a, b) => b.title.localeCompare(a.title);
    case "progress":
      return (a, b) => b.seen / b.released - a.seen / a.released;
    default:
      return (a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt);
  }
}
