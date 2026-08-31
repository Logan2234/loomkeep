import type { MusicDetailDto } from "@loomkeep/shared";
import { MusicSource } from "@loomkeep/shared";
import { ApiProperty } from "@nestjs/swagger";
import { MusicEntryResponseDto } from "./music-entry-response.dto";
import { MusicExternalLinkResponseDto } from "./music-external-link-response.dto";
import { MusicSummaryResponseDto } from "./music-summary-response.dto";
import { MusicTrackResponseDto } from "./music-track-response.dto";

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
  label!: string | null;
  catalogNumber!: string | null;
  tracks!: MusicTrackResponseDto[];
  totalDurationMs!: number | null;
  extraCoverImages!: { url: string; type: string }[];
  entry!: MusicEntryResponseDto | null;
}
