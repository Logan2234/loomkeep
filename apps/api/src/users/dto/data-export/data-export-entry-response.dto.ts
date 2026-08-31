import type {
  CatalogSource,
  DataExportEntry,
  EntryStatus,
  MediaType,
} from "@loomkeep/shared";

class DataExportEntryExternalIdResponseDto {
  source!: string;
  externalId!: string;
}

class DataExportEntryMediaResponseDto {
  type!: MediaType;
  title!: string;
  canonicalSource!: CatalogSource;
  sourceId!: string;
  externalIds!: DataExportEntryExternalIdResponseDto[];
}

export class DataExportEntryResponseDto implements DataExportEntry {
  media!: DataExportEntryMediaResponseDto;
  status!: EntryStatus;
  rating!: number | null;
  notes!: string | null;
  favorite!: boolean;
  startedAt!: string | null;
  finishedAt!: string | null;
  createdAt!: string;
}
