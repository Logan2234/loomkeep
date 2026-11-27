import type {
  ListenLinkDto,
  MusicExternalLinkDto,
  MusicSummaryDto,
  MusicTrackDto,
} from "@loomkeep/shared/contracts";
import type { MusicSource } from "@loomkeep/shared/enums";
import type { ProviderExternalId } from "../../common/provider-external-id";

/** Everything a provider knows about one album, in canonical form. */
export interface ProviderMusicDetails {
  summary: MusicSummaryDto;
  genres: string[];
  albumType: string | null;
  trackCount: number | null;
  releaseDate: string | null;
  releaseDatePrecision: "day" | "month" | "year" | null;
  /** Other albums by the primary artist, standing in for "similar titles". */
  sameArtistAlbums: MusicSummaryDto[];
  externalIds: ProviderExternalId<MusicSource>[];
  tags: string[];
  disambiguation: string | null;
  externalLinks: MusicExternalLinkDto[];
  listenLinks: ListenLinkDto[];
  label: string | null;
  catalogNumber: string | null;
  tracks: MusicTrackDto[];
  totalDurationMs: number | null;
  extraCoverImages: { url: string; type: string }[];
  /**
   * The editions request failed: tracks, duration, label and listening links
   * are missing, so the copy must not pass for a fresh one.
   */
  partial?: boolean;
}

export interface MusicCatalogProvider {
  readonly source: MusicSource;
  search(query: string): Promise<MusicSummaryDto[]>;
  getDetails(sourceId: string): Promise<ProviderMusicDetails>;
}
