import type { ReportTargetSummaryDto } from "@loomkeep/shared";

export class ReportTargetSummaryResponseDto implements ReportTargetSummaryDto {
  label!: string;
  href!: string | null;
  targetOwnerUsername!: string | null;
}
