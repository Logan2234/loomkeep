import type { BookEntryDto, BookReadingDto } from "@loomkeep/shared/contracts";
import type { BookOwnershipStatus, BookStatus } from "@loomkeep/shared/enums";
import { BookItemResponseDto } from "./book-item-response.dto";

export class BookReadingResponseDto implements BookReadingDto {
  id!: string;
  number!: number;
  status!: BookReadingDto["status"];
  editionKey!: string | null;
  referencePageCount!: number | null;
  currentPage!: number;
  startedAt!: string | null;
  finishedAt!: string | null;
  sessionCount!: number;
  trackedMinutes!: number;
  pagesRead!: number;
  legacyIncomplete!: boolean;
}

export class BookEntryResponseDto implements BookEntryDto {
  id!: string;
  book!: BookItemResponseDto;
  status!: BookStatus;
  rating!: number | null;
  notes!: string | null;
  favorite!: boolean;
  currentPage!: number;
  editionKey!: string | null;
  referencePageCount!: number | null;
  trackedReadingMinutes!: number;
  lastSessionAt!: string | null;
  startedAt!: string | null;
  finishedAt!: string | null;
  createdAt!: string;
  readings!: BookReadingResponseDto[];
  ownershipStatus!: BookOwnershipStatus;
  ownershipSource!: string | null;
  lentOut!: boolean;
  loanActive!: boolean;
  loanPerson!: string | null;
  loanSince!: string | null;
}
