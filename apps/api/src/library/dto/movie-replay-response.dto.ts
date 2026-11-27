import type { MovieReplayDto } from "@loomkeep/shared/contracts";

export class MovieReplayResponseDto implements MovieReplayDto {
  id!: string;
  finishedAt!: string;
}
