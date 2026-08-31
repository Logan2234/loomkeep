import type { ImportReport } from "@loomkeep/shared";
import { ImportReportTileResponseDto } from "./import-report-tile-response.dto";

export class ImportReportResponseDto implements ImportReport {
  overwrite!: boolean;
  tiles!: ImportReportTileResponseDto[];
}
