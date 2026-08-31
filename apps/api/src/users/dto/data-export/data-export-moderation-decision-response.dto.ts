import type {
  DataExportModerationDecision,
  ModerationLegalBasis,
  ModerationMeasure,
  ReportCategory,
  ReportMotif,
  ReportTargetType,
} from "@loomkeep/shared";

export class DataExportModerationDecisionResponseDto implements DataExportModerationDecision {
  measure!: ModerationMeasure;
  targetType!: ReportTargetType;
  legalBasis!: ModerationLegalBasis;
  reasonCategory!: ReportCategory | null;
  reasonMotif!: ReportMotif | null;
  reasonText!: string;
  contentSnapshot!: string | null;
  decidedAt!: string;
}
