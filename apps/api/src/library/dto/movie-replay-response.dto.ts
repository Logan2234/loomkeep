import type { MovieReplayDto } from "@loomkeep/shared";

export class MovieReplayResponseDto implements MovieReplayDto {
  id!: string;
  finishedAt!: string;
}
