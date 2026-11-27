import { utcDateKey } from "../common/date.util";
import { canonicalExternalId } from "../common/external-id.util";

/** A date cell of a CSV export: `YYYY-MM-DD`, or empty. */
export const csvDate = (d: Date | null): string => (d ? utcDateKey(d) : "");

/** Completion dates of the cycles after the first: the export's `replays`. */
export function laterCompletions(
  cycles: { number: number; status: string; finishedAt: Date | null }[],
): string[] {
  return cycles.flatMap((cycle) =>
    cycle.number > 1 && cycle.status === "COMPLETED" && cycle.finishedAt
      ? [cycle.finishedAt.toISOString()]
      : [],
  );
}

/** Web route of a cached item under its domain's prefix, without `/app`. */
export function itemHref(
  prefix: string,
  item: {
    canonicalSource: string;
    externalIds: { source: string; externalId: string }[];
  },
): string {
  return `/${prefix}/${canonicalExternalId(item, item.externalIds)}`;
}
