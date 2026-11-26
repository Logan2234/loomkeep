import type {
  Domain,
  ImportLastRunDto,
  ImportRunDto,
  ImportSource,
} from "@loomkeep/shared";
import { ImportReportTileResponseDto } from "./import-report-tile-response.dto";

export class ImportRunResponseDto implements ImportRunDto {
  sourceId!: ImportSource;
  domain!: Domain | null;
  status!: string;
  itemCount!: number;
  tiles!: ImportReportTileResponseDto[] | null;
  summary!: string | null;
  finishedAt!: string;
}

export class ImportLastRunResponseDto implements ImportLastRunDto {
  run!: ImportRunResponseDto | null;
}
