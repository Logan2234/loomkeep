import type { MusicItemDto } from "@loomkeep/shared";
import { MusicSource } from "@loomkeep/shared";
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
