import type {
  DataExportGameEntry,
  GameOwnershipStatus,
  GameSource,
  GameStatus,
  SessionSource,
} from "@loomkeep/shared";

class DataExportGameExternalIdResponseDto {
  source!: string;
  externalId!: string;
}

class DataExportGameEntryGameResponseDto {
  title!: string;
  canonicalSource!: GameSource;
  sourceId!: string;
  externalIds!: DataExportGameExternalIdResponseDto[];
}

class DataExportGameSessionResponseDto {
  durationMinutes!: number;
  occurredAt!: string;
  source!: SessionSource;
  createdAt!: string;
}

export class DataExportGameEntryResponseDto implements DataExportGameEntry {
  game!: DataExportGameEntryGameResponseDto;
  status!: GameStatus;
  rating!: number | null;
  notes!: string | null;
  favorite!: boolean;
  playtimeMinutes!: number;
  trackedPlaytimeMinutes!: number;
  steamPlaytimeMinutes!: number | null;
  steamSyncedAt!: string | null;
  ownershipStatus!: GameOwnershipStatus;
  ownershipSource!: string | null;
  startedAt!: string | null;
  finishedAt!: string | null;
  createdAt!: string;
  replays!: string[];
  sessions!: DataExportGameSessionResponseDto[];
}
