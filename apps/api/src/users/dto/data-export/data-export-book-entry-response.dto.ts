import type {
  BookOwnershipStatus,
  BookSource,
  BookStatus,
  DataExportBookEntry,
} from "@loomkeep/shared";

class DataExportBookExternalIdResponseDto {
  source!: string;
  externalId!: string;
}

class DataExportBookEntryBookResponseDto {
  title!: string;
  authors!: string[];
  canonicalSource!: BookSource;
  sourceId!: string;
  externalIds!: DataExportBookExternalIdResponseDto[];
}

export class DataExportBookEntryResponseDto implements DataExportBookEntry {
  book!: DataExportBookEntryBookResponseDto;
  status!: BookStatus;
  rating!: number | null;
  notes!: string | null;
  favorite!: boolean;
  currentPage!: number;
  ownershipStatus!: BookOwnershipStatus;
  ownershipSource!: string | null;
  startedAt!: string | null;
  finishedAt!: string | null;
  createdAt!: string;
  replays!: string[];
}
