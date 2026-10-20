import { type ReportResolution, REPORT_RESOLUTIONS } from "@loomkeep/shared";
import { IsIn } from "class-validator";

export class ResolveReportBody {
  @IsIn(REPORT_RESOLUTIONS)
  status!: ReportResolution;
}
