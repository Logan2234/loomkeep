import type { SagaMemberDto } from "@loomkeep/shared";

type SagaProgress =
  | {
      state: "inProgress" | "waiting";
      next: SagaMemberDto;
      seen: number;
      released: number;
    }
  | { state: "finished"; next: null; seen: number; released: number }
  | { state: "none" };

const isSeen = (m: SagaMemberDto) =>
  m.status === "COMPLETED" || m.status === "UP_TO_DATE";

/**
 * Where the viewer stands in a saga. In progress: a work finished and a
 * released one still to see — a dropped work isn't one. Waiting: everything
 * released seen (or dropped), with a sequel announced. Finished: the same
 * with nothing announced. A saga never started — or only ever dropped —
 * stays out of the view.
 */
export function sagaProgress(members: SagaMemberDto[]): SagaProgress {
  const released = members.filter((m) => !m.upcoming);
  const seen = released.filter(isSeen).length;
  if (seen === 0) return { state: "none" };

  const counts = { seen, released: released.length };
  const toSee = released.find((m) => !isSeen(m) && m.status !== "DROPPED");
  if (toSee) return { state: "inProgress", next: toSee, ...counts };

  const announced = members.find((m) => m.upcoming);
  return announced
    ? { state: "waiting", next: announced, ...counts }
    : { state: "finished", next: null, ...counts };
}
