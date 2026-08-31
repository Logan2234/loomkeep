import type { ErrorCode, ImportJobDto } from "@loomkeep/shared";
import { ImportPlanResponseDto } from "./import-plan-response.dto";
import { ImportReportResponseDto } from "./import-report-response.dto";

class ImportJobProgressResponseDto {
  done!: number;
  total!: number;
}

export class ImportJobResponseDto implements ImportJobDto {
  id!: string;
  status!: "running" | "completed" | "failed";
  progress!: ImportJobProgressResponseDto;
  plan!: ImportPlanResponseDto | null;
  report!: ImportReportResponseDto | null;
  error!: string | null;
  errorCode?: ErrorCode | null;
}
