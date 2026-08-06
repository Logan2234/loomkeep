import type {
  AdminImportSourceStatDto,
  AdminImportSummaryDto,
} from "@loomkeep/shared";

/** How many sources the summary's per-source breakdown carries. */
const TOP_SOURCES_LIMIT = 6;

/** One `groupBy(sourceId)` row, flattened out of Prisma's `_count`/`_sum` shape. */
export interface ImportSourceCounts {
  sourceId: string;
  runs: number;
  /** Items written by those runs (a failed run can still have written none). */
  items: number;
}

/**
 * Share (0-100) of runs that succeeded. Null rather than 0 when nothing was ever
 * imported: an empty log is "no data", not "everything failed".
 */
export function importSuccessPercent(
  success: number,
  failure: number,
): number | null {
  const total = success + failure;
  return total === 0 ? null : Math.round((success / total) * 100);
}

/**
 * Sources by volume, most items first. Ties break on the source id so the
 * ranking doesn't reshuffle between two refreshes of the same data.
 */
export function rankImportSources(
  rows: ImportSourceCounts[],
  limit = TOP_SOURCES_LIMIT,
): AdminImportSourceStatDto[] {
  return [...rows]
    .sort((a, b) => b.items - a.items || a.sourceId.localeCompare(b.sourceId))
    .slice(0, limit);
}

export function buildImportSummary(
  success: number,
  failure: number,
  sources: ImportSourceCounts[],
): AdminImportSummaryDto {
  return {
    total: success + failure,
    success,
    failure,
    successPercent: importSuccessPercent(success, failure),
    bySource: rankImportSources(sources),
  };
}
