import { ReportCategory, ReportMotif } from "@loomkeep/shared";
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
  @MaxLength(500)
  reason?: string;
}
