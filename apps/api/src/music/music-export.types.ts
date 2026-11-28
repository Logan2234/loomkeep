import type {
  MusicOwnershipStatus,
  MusicSource,
  MusicStatus,
} from "@loomkeep/shared/enums";

// What the account export (`GET /users/me/export`) holds for each album entry.

export interface DataExportMusicEntry {
  album: {
    title: string;
    artists: string[];
    canonicalSource: MusicSource;
    sourceId: string;
    externalIds: { source: string; externalId: string }[];
  };
  status: MusicStatus;
  rating: number | null;
  notes: string | null;
  favorite: boolean;
  ownershipStatus: MusicOwnershipStatus;
  ownershipSource: string | null;
  lentOut: boolean;
  loanPerson: string | null;
  loanSince: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
}
