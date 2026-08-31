import type {
  AdminReportsSummaryDto,
  AdminTopReporterDto,
} from "@loomkeep/shared";

class AdminTopReporterResponseDto implements AdminTopReporterDto {
  username!: string;
  reports!: number;
}

export class AdminReportsSummaryResponseDto implements AdminReportsSummaryDto {
  pending!: number;
  resolved!: number;
  dismissed!: number;
  medianResolutionHours!: number | null;
  foundedPercent!: number | null;
  topReporters!: AdminTopReporterResponseDto[];
}
