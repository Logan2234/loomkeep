import type { BookSearchResponseDto } from "@loomkeep/shared/contracts";
import { BookSummaryResponseDto } from "./book-summary-response.dto";

export class BookSearchResultResponseDto implements BookSearchResponseDto {
  results!: BookSummaryResponseDto[];
}
