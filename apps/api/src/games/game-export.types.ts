import type {
  GameOwnershipStatus,
  GameSource,
  GameStatus,
  SessionSource,
  TrackingCycleStatus,
} from "@loomkeep/shared/enums";

// What the account export (`GET /users/me/export`) holds for each game entry.

export interface DataExportGameEntry {
  game: {
    title: string;
    canonicalSource: GameSource;
    sourceId: string;
    externalIds: { source: string; externalId: string }[];
  };
  status: GameStatus;
  rating: number | null;
  notes: string | null;
  favorite: boolean;
  playtimeMinutes: number;
  trackedPlaytimeMinutes: number;
  steamPlaytimeMinutes: number | null;
  steamSyncedAt: string | null;
  ownershipStatus: GameOwnershipStatus;
  ownershipSource: string | null;
  lentOut: boolean;
  loanPerson: string | null;
  loanSince: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  /** Completed replays beyond the first, oldest first. */
  replays: string[];
  /** Every playthrough, the first and the unfinished ones included. */
  playthroughs: {
    number: number;
    status: TrackingCycleStatus;
    startedAt: string | null;
    finishedAt: string | null;
    trackedMinutes: number;
  }[];
  sessions: {
    playthroughNumber: number | null;
    durationMinutes: number;
    notes: string | null;
    occurredAt: string;
    source: SessionSource;
    createdAt: string;
  }[];
}
