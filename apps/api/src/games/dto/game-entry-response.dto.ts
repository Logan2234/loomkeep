import type {
  GameEntryDto,
  GameOwnershipStatus,
  GamePlaythroughDto,
  GameStatus,
} from "@loomkeep/shared";
import { GameItemResponseDto } from "./game-item-response.dto";

export class GamePlaythroughResponseDto implements GamePlaythroughDto {
  id!: string;
  number!: number;
  status!: GamePlaythroughDto["status"];
  startedAt!: string | null;
  finishedAt!: string | null;
  sessionCount!: number;
  trackedMinutes!: number;
  legacyIncomplete!: boolean;
}

export class GameEntryResponseDto implements GameEntryDto {
  id!: string;
  game!: GameItemResponseDto;
  status!: GameStatus;
  rating!: number | null;
  notes!: string | null;
  favorite!: boolean;
  playtimeMinutes!: number;
  trackedPlaytimeMinutes!: number;
  steamPlaytimeMinutes!: number | null;
  steamSyncedAt!: string | null;
  lastSessionAt!: string | null;
  startedAt!: string | null;
  finishedAt!: string | null;
  createdAt!: string;
  playthroughs!: GamePlaythroughResponseDto[];
  ownershipStatus!: GameOwnershipStatus;
  ownershipSource!: string | null;
  releaseAlertsEnabled!: boolean;
}
