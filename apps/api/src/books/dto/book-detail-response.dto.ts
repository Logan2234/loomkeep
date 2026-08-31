import type { BookDetailDto } from "@loomkeep/shared";
import { BookSource } from "@loomkeep/shared";
import { ApiProperty } from "@nestjs/swagger";
import { RatingResponseDto } from "../../catalog/dto/rating-response.dto";
import { BookEntryResponseDto } from "./book-entry-response.dto";
import { BookSummaryResponseDto } from "./book-summary-response.dto";

export class BookDetailResponseDto implements BookDetailDto {
  // See book-summary-response.dto.ts: single-member enum, needs an explicit hint.
  @ApiProperty({ enum: BookSource })
  source!: BookSource;

  sourceId!: string;
  title!: string;
  authors!: string[];
  year!: number | null;
  coverUrl!: string | null;
  isAdult!: boolean;
  overview!: string | null;
  subtitle!: string | null;
  publisher!: string | null;
  genres!: string[];
  pageCount!: number | null;
  releaseDate!: string | null;
  website!: string | null;
  sameAuthorBooks!: BookSummaryResponseDto[];
  ratings!: RatingResponseDto[];
  editionCount!: number | null;
  isbn!: string | null;
  series!: string | null;
  language!: string | null;
  firstSentence!: string | null;
  readOnlineUrl!: string | null;
  externalLinks!: { label: string; url: string }[];
  entry!: BookEntryResponseDto | null;
}
