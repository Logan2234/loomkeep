import {
  type ErrorCode,
  type ImportJobDto,
  type ImportJobStatus,
  IMPORT_JOB_STATUSES,
} from "@loomkeep/shared";
import { ApiProperty } from "@nestjs/swagger";
import { ImportPlanResponseDto } from "./import-plan-response.dto";
import { ImportReportResponseDto } from "./import-report-response.dto";

class ImportJobProgressResponseDto {
  done!: number;
  total!: number;
}

export class ImportJobResponseDto implements ImportJobDto {
  id!: string;
  @ApiProperty({ enum: IMPORT_JOB_STATUSES })
  status!: ImportJobStatus;

  progress!: ImportJobProgressResponseDto;
  plan!: ImportPlanResponseDto | null;
  report!: ImportReportResponseDto | null;
  error!: string | null;
  errorCode?: ErrorCode | null;
}
