import type {
  DataExportGameEntry,
  GameOwnershipStatus,
  GameSource,
  GameStatus,
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

export class DataExportGameEntryResponseDto implements DataExportGameEntry {
  game!: DataExportGameEntryGameResponseDto;
  status!: GameStatus;
  rating!: number | null;
  notes!: string | null;
  favorite!: boolean;
  playtimeMinutes!: number;
  ownershipStatus!: GameOwnershipStatus;
  ownershipSource!: string | null;
  startedAt!: string | null;
  finishedAt!: string | null;
  createdAt!: string;
  replays!: string[];
}
