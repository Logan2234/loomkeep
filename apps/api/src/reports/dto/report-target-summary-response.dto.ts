import type {
  ReportContextMessageDto,
  ReportTargetSummaryDto,
} from "@loomkeep/shared";

export class ReportContextMessageResponseDto implements ReportContextMessageDto {
  authorUsername!: string | null;
  text!: string | null;
  createdAt!: string;
  reported!: boolean;
}

export class ReportTargetSummaryResponseDto implements ReportTargetSummaryDto {
  label!: string;
  href!: string | null;
  targetOwnerUsername!: string | null;
  context?: ReportContextMessageResponseDto[];
}
