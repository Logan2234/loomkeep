import type { GameItemDto } from "@loomkeep/shared";
import { GameSource } from "@loomkeep/shared";
import { ApiProperty } from "@nestjs/swagger";

export class GameItemResponseDto implements GameItemDto {
  id!: string;
  title!: string;
  coverUrl!: string | null;

  // See game-summary-response.dto.ts: single-member enum, needs an explicit hint.
  @ApiProperty({ enum: GameSource })
  canonicalSource!: GameSource;

  sourceId!: string;
}
