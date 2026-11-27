import {
  type ReportResolution,
  REPORT_RESOLUTIONS,
} from "@loomkeep/shared/contracts";
import { IsIn } from "class-validator";

export class ResolveReportBody {
  @IsIn(REPORT_RESOLUTIONS)
  status!: ReportResolution;
}
