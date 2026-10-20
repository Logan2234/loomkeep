import type {
  ReportContextMessageDto,
  ReportTargetOwnerDto,
  ReportTargetSummaryDto,
} from "@loomkeep/shared";

export class ReportTargetOwnerResponseDto implements ReportTargetOwnerDto {
  username!: string;
  reportCount!: number;
}

export class ReportContextMessageResponseDto implements ReportContextMessageDto {
  authorUsername!: string | null;
  text!: string | null;
  createdAt!: string;
  reported!: boolean;
}

export class ReportTargetSummaryResponseDto implements ReportTargetSummaryDto {
  label!: string;
  deleted!: boolean;
  editedAfterReport!: boolean;
  authorDeleted!: boolean;
  href!: string | null;
  targetOwnerUsername!: string | null;
  context?: ReportContextMessageResponseDto[];
}
