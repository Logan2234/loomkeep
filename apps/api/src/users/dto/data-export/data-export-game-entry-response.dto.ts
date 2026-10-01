import type {
  DataExportGameEntry,
  GameOwnershipStatus,
  GameSource,
  GameStatus,
  SessionSource,
} from "@loomkeep/shared";

class DataExportGameExternalIdResponseDto {
  /**
   * The catalogue or service the id belongs to.
   * @example "IGDB"
   */
  source!: string;

  /**
   * The id there.
   * @example "113112"
   */
  externalId!: string;
}

class DataExportGameEntryGameResponseDto {
  /**
   * The game's title.
   * @example "Hades"
   */
  title!: string;

  /**
   * The catalogue Loomkeep reads it from.
   * @example "IGDB"
   */
  canonicalSource!: GameSource;

  /**
   * Its id in that catalogue.
   * @example "113112"
   */
  sourceId!: string;

  /** Its ids in the catalogue. */
  externalIds!: DataExportGameExternalIdResponseDto[];
}

class DataExportGameSessionResponseDto {
  /**
   * The playthrough it belongs to, 1 for the first; null outside one.
   * @example 1
   */
  playthroughNumber!: number | null;

  /**
   * Length of the session, in minutes.
   * @example 45
   */
  durationMinutes!: number;

  /**
   * Notes on the session.
   * @example "Finally beat the second boss"
   */
  notes!: string | null;

  /**
   * When the session happened.
   * @example "2026-09-30T21:00:00.000Z"
   */
  occurredAt!: string;

  /**
   * How it was logged: MANUAL, TIMER or IMPORT.
   * @example "TIMER"
   */
  source!: SessionSource;

  /**
   * When it was logged.
   * @example "2026-09-30T21:00:00.000Z"
   */
  createdAt!: string;
}

export class DataExportGameEntryResponseDto implements DataExportGameEntry {
  /** The game. */
  game!: DataExportGameEntryGameResponseDto;

  /**
   * Its status.
   * @example "PLAYING"
   */
  status!: GameStatus;

  /**
   * The account's rating, 0 to 10 with half points.
   * @example 8.5
   */
  rating!: number | null;

  /**
   * Private notes on the entry.
   * @example "Lent by Max"
   */
  notes!: string | null;

  /**
   * Marked as a favourite.
   * @example true
   */
  favorite!: boolean;

  /**
   * Playtime shown, in minutes.
   * @example 1320
   */
  playtimeMinutes!: number;

  /**
   * Of which logged in sessions.
   * @example 300
   */
  trackedPlaytimeMinutes!: number;

  /**
   * Playtime read from Steam, when imported.
   * @example 1020
   */
  steamPlaytimeMinutes!: number | null;

  /**
   * When Steam was last read.
   * @example "2026-09-30T21:00:00.000Z"
   */
  steamSyncedAt!: string | null;

  /**
   * How the game is held.
   * @example "DIGITAL"
   */
  ownershipStatus!: GameOwnershipStatus;

  /**
   * Where, for a digital or subscription copy.
   * @example "Steam"
   */
  ownershipSource!: string | null;

  /**
   * When it was started.
   * @example "2026-08-02T20:15:00.000Z"
   */
  startedAt!: string | null;

  /**
   * When it was finished.
   * @example "2026-08-30T22:40:00.000Z"
   */
  finishedAt!: string | null;

  /**
   * When it was added to the library.
   * @example "2026-03-14T09:26:53.000Z"
   */
  createdAt!: string;

  /**
   * When each later playthrough was completed.
   * @example ["2026-05-01T21:00:00.000Z"]
   */
  replays!: string[];

  /** Play sessions, oldest first. */
  sessions!: DataExportGameSessionResponseDto[];
}
