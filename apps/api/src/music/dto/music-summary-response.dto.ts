import type { MusicSummaryDto } from "@loomkeep/shared";
import { MusicSource } from "@loomkeep/shared";
import { ApiProperty } from "@nestjs/swagger";

export class MusicSummaryResponseDto implements MusicSummaryDto {
  // MusicSource has a single member today — see games' equivalent DTO for
  // why this needs an explicit hint rather than relying on the swagger plugin.
  @ApiProperty({ enum: MusicSource })
  source!: MusicSource;

  sourceId!: string;
  title!: string;
  artists!: string[];
  year!: number | null;
  coverUrl!: string | null;
}
