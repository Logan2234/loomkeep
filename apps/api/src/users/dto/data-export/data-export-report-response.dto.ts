import type {
  DataExportReport,
  ReportCategory,
  ReportMotif,
  ReportStatus,
  ReportTargetType,
} from "@loomkeep/shared";

export class DataExportReportResponseDto implements DataExportReport {
  /**
   * What was reported.
   * @example "COMMENT"
   */
  targetType!: ReportTargetType;

  /**
   * The report's category.
   * @example "SPAM"
   */
  category!: ReportCategory | null;

  /**
   * Its precise motive.
   * @example "SPAM_PROMOTIONAL"
   */
  motif!: ReportMotif | null;

  /**
   * The account's explanation.
   * @example "Same link posted everywhere"
   */
  reason!: string | null;

  /**
   * PENDING, RESOLVED or DISMISSED.
   * @example "RESOLVED"
   */
  status!: ReportStatus;

  /**
   * When it was filed.
   * @example "2026-09-30T21:00:00.000Z"
   */
  createdAt!: string;

  /**
   * When it was handled.
   * @example "2026-10-01T08:00:00.000Z"
   */
  resolvedAt!: string | null;
}
