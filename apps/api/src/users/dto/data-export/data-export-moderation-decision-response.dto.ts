import type {
  DataExportModerationDecision,
  ModerationLegalBasis,
  ModerationMeasure,
  ReportCategory,
  ReportMotif,
  ReportTargetType,
} from "@loomkeep/shared";

export class DataExportModerationDecisionResponseDto implements DataExportModerationDecision {
  /**
   * What was done.
   * @example "COMMENT_REMOVED"
   */
  measure!: ModerationMeasure;

  /**
   * What it applied to.
   * @example "COMMENT"
   */
  targetType!: ReportTargetType;

  /**
   * ILLEGAL_CONTENT or TOS_BREACH.
   * @example "TOS_BREACH"
   */
  legalBasis!: ModerationLegalBasis;

  /**
   * The category of the report behind it.
   * @example "HARASSMENT"
   */
  reasonCategory!: ReportCategory | null;

  /**
   * Its precise motive.
   * @example "HARASSMENT_INSULTS"
   */
  reasonMotif!: ReportMotif | null;

  /**
   * The facts held against the content.
   * @example "Repeated insults towards another member."
   */
  reasonText!: string;

  /**
   * A copy of the content as it was.
   * @example "You clearly know nothing about films"
   */
  contentSnapshot!: string | null;

  /**
   * When the decision was taken.
   * @example "2026-09-30T21:00:00.000Z"
   */
  decidedAt!: string;
}
