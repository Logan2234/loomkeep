import type {
  MusicExternalLinkDto,
  MusicSource,
  MusicSummaryDto,
  MusicTrackDto,
} from "@loomkeep/shared";
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
  label: string | null;
  catalogNumber: string | null;
  tracks: MusicTrackDto[];
  totalDurationMs: number | null;
  extraCoverImages: { url: string; type: string }[];
}

export interface MusicCatalogProvider {
  readonly source: MusicSource;
  search(query: string): Promise<MusicSummaryDto[]>;
  getDetails(sourceId: string): Promise<ProviderMusicDetails>;
}
