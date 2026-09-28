import {
  ModerationLegalBasis,
  ModerationMeasure,
  type ModerationTransparencyDto,
  type ReportCategory,
  type ReportStatus,
} from "@loomkeep/shared";
import { medianResolutionHours } from "../admin/admin-social-stats.util";

export interface TransparencyReportRow {
  category: ReportCategory | null;
  status: ReportStatus;
  createdAt: Date;
  resolvedAt: Date | null;
  decisionCount: number;
}

export interface TransparencyDecisionRow {
  measure: ModerationMeasure;
  legalBasis: ModerationLegalBasis;
  reportId: string | null;
}

/** Every year from the current one back to `firstYear`, newest first. */
export function transparencyYears(
  currentYear: number,
  firstYear: number | null,
): number[] {
  const oldest = Math.min(firstYear ?? currentYear, currentYear);
  return Array.from(
    { length: currentYear - oldest + 1 },
    (_, i) => currentYear - i,
  );
}

/**
 * A report counts as "with measure" as soon as a decision references it,
 * whatever its status: an admin can also close a report as RESOLVED without
 * taking any measure, so the status alone can't tell the two apart.
 */
export function summarizeReports(
  rows: TransparencyReportRow[],
): ModerationTransparencyDto["reports"] {
  const byCategory = new Map<ReportCategory, number>();

  for (const row of rows) {
    // Reports filed before the category picker existed have none.
    const category = row.category ?? "OTHER";
    byCategory.set(category, (byCategory.get(category) ?? 0) + 1);
  }

  const withoutMeasure = rows.filter((r) => r.decisionCount === 0);
  const closed = rows.filter(
    (r): r is TransparencyReportRow & { resolvedAt: Date } =>
      r.resolvedAt !== null,
  );

  return {
    total: rows.length,
    withMeasure: rows.length - withoutMeasure.length,
    closedWithoutMeasure: withoutMeasure.filter((r) => r.status !== "PENDING")
      .length,
    pending: withoutMeasure.filter((r) => r.status === "PENDING").length,
    byCategory: [...byCategory]
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count),
    medianHandlingHours: medianResolutionHours(closed),
  };
}

export function summarizeMeasures(
  rows: TransparencyDecisionRow[],
): ModerationTransparencyDto["measures"] {
  return {
    total: rows.length,
    withoutReport: rows.filter((r) => r.reportId === null).length,
    byMeasure: Object.values(ModerationMeasure).map((measure) => ({
      measure,
      count: rows.filter((r) => r.measure === measure).length,
    })),
    byLegalBasis: Object.values(ModerationLegalBasis).map((legalBasis) => ({
      legalBasis,
      count: rows.filter((r) => r.legalBasis === legalBasis).length,
    })),
  };
}
