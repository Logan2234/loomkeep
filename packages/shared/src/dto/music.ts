import type { MusicOwnershipStatus, MusicSource, MusicStatus } from "../enums";

/** An album as returned by a live catalogue search (not persisted). */
export interface MusicSummaryDto {
  source: MusicSource;
  sourceId: string;
  title: string;
  /** Credited artist names, when known. */
  artists: string[];
  /** First release year, when known. */
  year: number | null;
  coverUrl: string | null;
}

export interface MusicSearchResponseDto {
  results: MusicSummaryDto[];
}

/** One track of the album's representative release. */
export interface MusicTrackDto {
  /** 1-indexed position within its medium (resets per disc on multi-disc releases). */
  position: number;
  title: string;
  /** Track duration in milliseconds, when known. */
  durationMs: number | null;
}

/** A curated external link (Discogs, Bandcamp, Wikidata…). */
export interface MusicExternalLinkDto {
  label: string;
  url: string;
}

/** Full album details, fetched live from the source. */
export interface MusicDetailsDto extends MusicSummaryDto {
  /** Tags/genres the source associates with the album. */
  genres: string[];
  /** Release-group primary type (Album/EP/Single/Compilation…), when known. */
  albumType: string | null;
  /** Number of tracks, when known. */
  trackCount: number | null;
  /** ISO first-release date; null when the source has none. */
  releaseDate: string | null;
  /**
   * How precise `releaseDate` actually is — MusicBrainz dates can be
   * year-only or year-month, padded to a full date; null alongside a null
   * `releaseDate`. Display accordingly instead of implying false precision.
   */
  releaseDatePrecision: "day" | "month" | "year" | null;
  /** Other albums by the primary artist — stands in for "similar titles". */
  sameArtistAlbums: MusicSummaryDto[];
  /** Folksonomy tags — distinct from `genres`. */
  tags: string[];
  /** Short clarifying text MusicBrainz stores for the release-group, if any. */
  disambiguation: string | null;
  /** Curated external links (Discogs, Bandcamp, Wikidata, official site, Wikipedia…). */
  externalLinks: MusicExternalLinkDto[];
  /** Record label of the representative release, when known. */
  label: string | null;
  /** Catalog number of the representative release, when known. */
  catalogNumber: string | null;
  /** Track listing of the representative release. */
  tracks: MusicTrackDto[];
  /** Sum of known track durations, in milliseconds; null when none are known. */
  totalDurationMs: number | null;
  /** Cover art beyond the main front cover (back, booklet…). */
  extraCoverImages: { url: string; type: string }[];
}

/** A persisted album referenced by at least one user (on-demand cache). */
export interface MusicItemDto {
  id: string;
  title: string;
  artists: string[];
  coverUrl: string | null;
  albumType: string | null;
  canonicalSource: MusicSource;
  /** External ID in `canonicalSource`, used to address the album detail page. */
  sourceId: string;
}

export interface MusicEntryDto {
  id: string;
  album: MusicItemDto;
  status: MusicStatus;
  /** 0–10, half-points allowed. */
  rating: number | null;
  notes: string | null;
  favorite: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  /** When the entry was added to the library (ISO). */
  createdAt: string;
  /** How the user holds this album, if set (NONE = unset). */
  ownershipStatus: MusicOwnershipStatus;
  /** Free-form detail for DIGITAL/STREAMING (e.g. "Spotify"); null otherwise. */
  ownershipSource: string | null;
}

/** Body for creating/updating a library entry from a catalogue album. */
export interface UpsertMusicEntryDto {
  source: MusicSource;
  sourceId: string;
  status?: MusicStatus;
  rating?: number | null;
  notes?: string | null;
  favorite?: boolean;
}

/** Body for patching an existing music library entry. */
export interface UpdateMusicEntryDto {
  status?: MusicStatus;
  rating?: number | null;
  notes?: string | null;
  favorite?: boolean;
  startedAt?: string | null;
  finishedAt?: string | null;
  ownershipStatus?: MusicOwnershipStatus;
  ownershipSource?: string | null;
}

/**
 * Everything the album detail page needs in one call: catalogue metadata
 * (cached if persisted, else fetched live) + the current user's library state.
 * `entry` is null when the album is not in the library.
 */
export interface MusicDetailDto extends MusicDetailsDto {
  entry: MusicEntryDto | null;
}
