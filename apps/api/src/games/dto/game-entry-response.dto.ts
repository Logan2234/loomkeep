import type {
  GameEntryDto,
  GameOwnershipStatus,
  GameStatus,
} from "@loomkeep/shared";
import { GameItemResponseDto } from "./game-item-response.dto";
import { GameReplayResponseDto } from "./game-replay-response.dto";

export class GameEntryResponseDto implements GameEntryDto {
  id!: string;
  game!: GameItemResponseDto;
  status!: GameStatus;
  rating!: number | null;
  notes!: string | null;
  favorite!: boolean;
  playtimeMinutes!: number;
  startedAt!: string | null;
  finishedAt!: string | null;
  createdAt!: string;
  replays!: GameReplayResponseDto[];
  ownershipStatus!: GameOwnershipStatus;
  ownershipSource!: string | null;
}
