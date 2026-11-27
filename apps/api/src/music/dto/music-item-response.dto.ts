import type { MusicItemDto } from "@loomkeep/shared/contracts";
import { MusicSource } from "@loomkeep/shared/enums";
import { ApiProperty } from "@nestjs/swagger";

export class MusicItemResponseDto implements MusicItemDto {
  id!: string;
  title!: string;
  artists!: string[];
  coverUrl!: string | null;
  albumType!: string | null;

  @ApiProperty({ enum: MusicSource })
  canonicalSource!: MusicSource;

  sourceId!: string;
}
