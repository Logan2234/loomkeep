import type { DataExportImportRun } from "@loomkeep/shared";

export class DataExportImportRunResponseDto implements DataExportImportRun {
  sourceId!: string;
  status!: string;
  itemCount!: number;
  overwrite!: boolean;
  summary!: string | null;
  error!: string | null;
  startedAt!: string;
  finishedAt!: string;
}
