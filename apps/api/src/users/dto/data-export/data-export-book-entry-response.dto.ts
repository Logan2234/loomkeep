import type {
  BookOwnershipStatus,
  BookSource,
  BookStatus,
  DataExportBookEntry,
  SessionSource,
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

class DataExportBookSessionResponseDto {
  durationMinutes!: number;
  pagesRead!: number;
  startPage!: number | null;
  endPage!: number | null;
  occurredAt!: string;
  source!: SessionSource;
  createdAt!: string;
}

export class DataExportBookEntryResponseDto implements DataExportBookEntry {
  book!: DataExportBookEntryBookResponseDto;
  status!: BookStatus;
  rating!: number | null;
  notes!: string | null;
  favorite!: boolean;
  currentPage!: number;
  editionKey!: string | null;
  referencePageCount!: number | null;
  trackedReadingMinutes!: number;
  ownershipStatus!: BookOwnershipStatus;
  ownershipSource!: string | null;
  startedAt!: string | null;
  finishedAt!: string | null;
  createdAt!: string;
  replays!: string[];
  sessions!: DataExportBookSessionResponseDto[];
}
