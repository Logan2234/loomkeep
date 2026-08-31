import type { BookItemDto } from "@loomkeep/shared";
import { BookSource } from "@loomkeep/shared";
import { ApiProperty } from "@nestjs/swagger";

export class BookItemResponseDto implements BookItemDto {
  id!: string;
  title!: string;
  authors!: string[];
  coverUrl!: string | null;
  pageCount!: number | null;

  @ApiProperty({ enum: BookSource })
  canonicalSource!: BookSource;

  sourceId!: string;
}
