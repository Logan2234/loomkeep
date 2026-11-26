import type { ImportReportTile, ImportReportTileId } from "@loomkeep/shared";

export class ImportReportTileResponseDto implements ImportReportTile {
  id!: ImportReportTileId;
  value!: number;
  watchlistCount?: number;
}
