import type {
  DataExportReport,
  ReportCategory,
  ReportMotif,
  ReportStatus,
  ReportTargetType,
} from "@loomkeep/shared";

export class DataExportReportResponseDto implements DataExportReport {
  targetType!: ReportTargetType;
  category!: ReportCategory | null;
  motif!: ReportMotif | null;
  reason!: string | null;
  status!: ReportStatus;
  createdAt!: string;
  resolvedAt!: string | null;
}
