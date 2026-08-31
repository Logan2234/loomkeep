import type { DataExportWatch, MediaType } from "@loomkeep/shared";

class DataExportWatchMediaResponseDto {
  type!: MediaType;
  title!: string;
  sourceId!: string;
}

export class DataExportWatchResponseDto implements DataExportWatch {
  media!: DataExportWatchMediaResponseDto;
  seasonNumber!: number;
  episodeNumber!: number;
  episodeTitle!: string | null;
  watchedAt!: string;
}
