import {
  POSSESSION_MIN_RATIO,
  type PossessionBreakdownDto,
} from "@loomkeep/shared";

/**
 * Aggregates ownership statuses into a breakdown, or flags "not enough data"
 * when too few entries opted in. `"NONE"` (the default, unset value on every
 * domain's ownership enum) counts toward the denominator but never appears in
 * the breakdown itself — it means "not renseigné", not a possession kind.
 */
export function computePossessionBreakdown(
  ownershipStatuses: string[],
): PossessionBreakdownDto {
  const total = ownershipStatuses.length;
  const renseigned = ownershipStatuses.filter((s) => s !== "NONE");

  const ratio = total > 0 ? renseigned.length / total : 0;

  if (ratio < POSSESSION_MIN_RATIO) {
    return { sufficientData: false, renseignedRatio: ratio };
  }

  const counts = new Map<string, number>();

  for (const status of renseigned) {
    counts.set(status, (counts.get(status) ?? 0) + 1);
  }

  return {
    sufficientData: true,
    byStatus: [...counts.entries()].map(([status, count]) => ({
      status,
      count,
    })),
  };
}
