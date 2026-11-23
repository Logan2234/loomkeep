import type {
  ListenLinkDto,
  MusicDetailDto,
  StoredMusicDetailDto,
} from "@loomkeep/shared";
import { LISTEN_SERVICES, MusicSource } from "@loomkeep/shared";
import { ApiProperty } from "@nestjs/swagger";
import { MusicEntryResponseDto } from "./music-entry-response.dto";
import { MusicExternalLinkResponseDto } from "./music-external-link-response.dto";
import { MusicSummaryResponseDto } from "./music-summary-response.dto";
import { MusicTrackResponseDto } from "./music-track-response.dto";

class ListenLinkResponseDto implements ListenLinkDto {
  @ApiProperty({ enum: LISTEN_SERVICES })
  service!: ListenLinkDto["service"];

  url!: string;
}

export class MusicDetailResponseDto implements MusicDetailDto {
  // See music-summary-response.dto.ts: single-member enum, needs an explicit hint.
  @ApiProperty({ enum: MusicSource })
  source!: MusicSource;

  sourceId!: string;
  title!: string;
  artists!: string[];
  year!: number | null;
  coverUrl!: string | null;
  genres!: string[];
  albumType!: string | null;
  trackCount!: number | null;
  releaseDate!: string | null;
  releaseDatePrecision!: "day" | "month" | "year" | null;
  sameArtistAlbums!: MusicSummaryResponseDto[];
  tags!: string[];
  disambiguation!: string | null;
  externalLinks!: MusicExternalLinkResponseDto[];
  listenLinks!: ListenLinkResponseDto[];
  label!: string | null;
  catalogNumber!: string | null;
  tracks!: MusicTrackResponseDto[];
  totalDurationMs!: number | null;
  extraCoverImages!: { url: string; type: string }[];
  commentTargetId!: string | null;
  entry!: MusicEntryResponseDto | null;
}

export class StoredMusicDetailResponseDto implements StoredMusicDetailDto {
  detail!: MusicDetailResponseDto | null;
}
