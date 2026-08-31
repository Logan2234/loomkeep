import type { BookSummaryDto } from "@loomkeep/shared";
import { BookSource } from "@loomkeep/shared";
import { ApiProperty } from "@nestjs/swagger";

export class BookSummaryResponseDto implements BookSummaryDto {
  // BookSource has a single member today — see games' equivalent DTO for why
  // this needs an explicit hint rather than relying on the swagger plugin.
  @ApiProperty({ enum: BookSource })
  source!: BookSource;

  sourceId!: string;
  title!: string;
  authors!: string[];
  year!: number | null;
  coverUrl!: string | null;
  isAdult!: boolean;
}
