import type { MusicTrackDto } from "@loomkeep/shared";

export class MusicTrackResponseDto implements MusicTrackDto {
  position!: number;
  title!: string;
  durationMs!: number | null;
}
