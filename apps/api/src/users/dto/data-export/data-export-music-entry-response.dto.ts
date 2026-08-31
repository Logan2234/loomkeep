import type {
  DataExportMusicEntry,
  MusicOwnershipStatus,
  MusicSource,
  MusicStatus,
} from "@loomkeep/shared";

class DataExportMusicExternalIdResponseDto {
  source!: string;
  externalId!: string;
}

class DataExportMusicEntryAlbumResponseDto {
  title!: string;
  artists!: string[];
  canonicalSource!: MusicSource;
  sourceId!: string;
  externalIds!: DataExportMusicExternalIdResponseDto[];
}

export class DataExportMusicEntryResponseDto implements DataExportMusicEntry {
  album!: DataExportMusicEntryAlbumResponseDto;
  status!: MusicStatus;
  rating!: number | null;
  notes!: string | null;
  favorite!: boolean;
  ownershipStatus!: MusicOwnershipStatus;
  ownershipSource!: string | null;
  startedAt!: string | null;
  finishedAt!: string | null;
  createdAt!: string;
}
