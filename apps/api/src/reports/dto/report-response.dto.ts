import type {
  ReportCategory,
  ReportDto,
  ReportMotif,
  ReportStatus,
  ReportTargetType,
} from "@loomkeep/shared";
import { UserSummaryResponseDto } from "../../common/dto/user-summary-response.dto";
import { ReportTargetSummaryResponseDto } from "./report-target-summary-response.dto";

export class ReportResponseDto implements ReportDto {
  id!: string;
  targetType!: ReportTargetType;
  targetId!: string;
  category!: ReportCategory | null;
  motif!: ReportMotif | null;
  reason!: string | null;
  status!: ReportStatus;
  createdAt!: string;
  resolvedAt!: string | null;
  reporter!: UserSummaryResponseDto | null;
  target!: ReportTargetSummaryResponseDto | null;
}
