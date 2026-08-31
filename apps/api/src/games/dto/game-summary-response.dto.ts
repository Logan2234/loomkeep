import type { GameSummaryDto } from "@loomkeep/shared";
import { GameSource } from "@loomkeep/shared";
import { ApiProperty } from "@nestjs/swagger";

export class GameSummaryResponseDto implements GameSummaryDto {
  // GameSource has a single member today — TS collapses a one-key union to
  // its literal, so the swagger plugin's union-based enum detection (which
  // needs a real UnionType) can't see it and would otherwise emit `string`.
  @ApiProperty({ enum: GameSource })
  source!: GameSource;

  sourceId!: string;
  title!: string;
  year!: number | null;
  coverUrl!: string | null;
  isAdult!: boolean;
}
