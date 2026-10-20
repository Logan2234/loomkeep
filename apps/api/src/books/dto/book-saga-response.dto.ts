import type {
  BookSagaDto,
  BookSagaMemberDto,
  BookSagaResponseDto as BookSagaResponse,
  BookStatus,
  LibraryBookSagasDto,
  LibrarySagaDto,
} from "@loomkeep/shared";
import { BookSummaryResponseDto } from "./book-summary-response.dto";

export class BookSagaMemberResponseDto
  extends BookSummaryResponseDto
  implements BookSagaMemberDto
{
  position!: number;
  status!: BookStatus | null;
}

export class BookSagaBodyResponseDto implements BookSagaDto {
  key!: string;
  title!: string;
  members!: BookSagaMemberResponseDto[];
}

export class BookSagaResponseDto implements BookSagaResponse {
  saga!: BookSagaBodyResponseDto | null;
}

export class LibraryBookSagaResponseDto implements LibrarySagaDto<BookSagaMemberDto> {
  key!: string;
  title!: string;
  members!: BookSagaMemberResponseDto[];
  next!: BookSagaMemberResponseDto | null;
  seen!: number;
  released!: number;
  lastActivityAt!: string;
  finishedAt!: string | null;
}

export class LibraryBookSagasResponseDto implements LibraryBookSagasDto {
  inProgress!: LibraryBookSagaResponseDto[];
  waiting!: LibraryBookSagaResponseDto[];
  finished!: LibraryBookSagaResponseDto[];
}
