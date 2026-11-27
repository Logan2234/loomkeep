import type {
  AdminImportSourceStatDto,
  AdminImportSummaryDto,
} from "@loomkeep/shared/contracts";

class AdminImportSourceStatResponseDto implements AdminImportSourceStatDto {
  sourceId!: string;
  runs!: number;
  items!: number;
}

export class AdminImportSummaryResponseDto implements AdminImportSummaryDto {
  total!: number;
  success!: number;
  failure!: number;
  successPercent!: number | null;
  bySource!: AdminImportSourceStatResponseDto[];
}
