import type { GameReplayDto } from "@loomkeep/shared";

export class GameReplayResponseDto implements GameReplayDto {
  id!: string;
  finishedAt!: string;
}
