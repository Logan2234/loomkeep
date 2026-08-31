import type {
  BookEntryDto,
  BookOwnershipStatus,
  BookStatus,
} from "@loomkeep/shared";
import { BookItemResponseDto } from "./book-item-response.dto";
import { BookReplayResponseDto } from "./book-replay-response.dto";

export class BookEntryResponseDto implements BookEntryDto {
  id!: string;
  book!: BookItemResponseDto;
  status!: BookStatus;
  rating!: number | null;
  notes!: string | null;
  favorite!: boolean;
  currentPage!: number;
  startedAt!: string | null;
  finishedAt!: string | null;
  createdAt!: string;
  replays!: BookReplayResponseDto[];
  ownershipStatus!: BookOwnershipStatus;
  ownershipSource!: string | null;
}
