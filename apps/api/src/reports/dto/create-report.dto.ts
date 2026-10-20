import {
  REPORT_REASON_MAX_LENGTH,
  ReportCategory,
  ReportMotif,
  ReportProfilePart,
} from "@loomkeep/shared";
import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateReportBody {
  @IsIn(Object.values(ReportCategory))
  category!: ReportCategory;

  /** Required unless category is OTHER — checked in ReportService.create. */
  @IsOptional()
  @IsIn(Object.values(ReportMotif))
  motif?: ReportMotif;

  @IsOptional()
  @IsString()
  @MaxLength(REPORT_REASON_MAX_LENGTH)
  reason?: string;

  /** Required on a profile report — checked in ReportService.create. */
  @IsOptional()
  @IsIn(Object.values(ReportProfilePart))
  profilePart?: ReportProfilePart;
}
