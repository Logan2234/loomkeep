import type {
  AdminImportDetailDto,
  AdminImportDetails,
  AdminImportRunDto,
  AdminImportStatus,
} from "@loomkeep/shared";

import { ApiProperty } from "@nestjs/swagger";
import { ImportReportResponseDto } from "../../import/dto/import-report-response.dto";

export class AdminImportRunResponseDto implements AdminImportRunDto {
  id!: string;
  userId!: string | null;
  identifier!: string | null;
  sourceId!: string;
  @ApiProperty({ enum: ["RUNNING", "SUCCESS", "FAILURE"] })
  status!: AdminImportStatus;

  @ApiProperty({ enum: ["analyze", "commit"], required: false })
  phase?: "analyze" | "commit";

  itemCount!: number;
  overwrite!: boolean;
  summary!: string | null;
  error!: string | null;
  startedAt!: string;
  finishedAt!: string | null;
  progress?: { done: number; total: number };
}

class ImportDetailItemResponseDto {
  title!: string;
  @ApiProperty({ enum: ["selected", "ignored", "unresolved"] })
  state!: "selected" | "ignored" | "unresolved";
}
class ImportDetailsResponseDto implements AdminImportDetails {
  items!: ImportDetailItemResponseDto[];
  @ApiProperty({ type: ImportReportResponseDto, nullable: true })
  report!: ImportReportResponseDto | null;
}
export class AdminImportDetailResponseDto
  extends AdminImportRunResponseDto
  implements AdminImportDetailDto
{
  details!: ImportDetailsResponseDto | null;
}
