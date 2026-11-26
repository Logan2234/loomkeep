import {
  LISTEN_SERVICES,
  type ListenLinkDto,
  type ListenService,
  MusicSource,
  MusicSummaryDto,
} from "@loomkeep/shared";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  fetchJson,
  HTTP_TIMEOUT_MS,
  identifyingUserAgent,
} from "../../common/http.util";
import { RequestThrottle } from "../../common/request-throttle";
import { QuotaTrackerService } from "../../quota/quota-tracker.service";
import type {
  MusicCatalogProvider,
  ProviderMusicDetails,
} from "./music-provider.types";

export const MUSICBRAINZ_API_URL = "https://musicbrainz.org/ws/2";
const COVER_ART_URL = "https://coverartarchive.org";

// MusicBrainz's usage policy caps unauthenticated requests at ~1/second per
// IP. Since this app calls out from a single self-hosted origin, this
// throttle is shared across every user of the instance — not per-user.
const MIN_REQUEST_INTERVAL_MS = 1050;

// MusicBrainz has no "similar albums" endpoint; other release-groups by the
// primary artist is the closest equivalent. Capped so the carousel stays a
// quick browse, not an endless scroll.
const MAX_SAME_ARTIST_ALBUMS = 10;

interface MusicBrainzArtistCredit {
  name: string;
  artist?: { id: string; name: string };
}

interface MusicBrainzGenre {
  name: string;
}

interface MusicBrainzTag {
  name: string;
}

interface MusicBrainzRelation {
  type: string;
  url?: { resource: string };
}

interface MusicBrainzReleaseGroup {
  id: string;
  title: string;
  "primary-type"?: string;
  "first-release-date"?: string;
  "artist-credit"?: MusicBrainzArtistCredit[];
  genres?: MusicBrainzGenre[];
  tags?: MusicBrainzTag[];
  disambiguation?: string;
  relations?: MusicBrainzRelation[];
}

interface MusicBrainzReleaseGroupSearch {
  "release-groups"?: MusicBrainzReleaseGroup[];
}

interface MusicBrainzTrack {
  position: number;
  title: string;
  /** Duration in milliseconds, when known. */
  length?: number;
}

interface MusicBrainzMedium {
  tracks?: MusicBrainzTrack[];
}

interface MusicBrainzLabelInfo {
  label?: { name: string };
  "catalog-number"?: string;
}

interface MusicBrainzRelease {
  id: string;
  status?: string;
  relations?: MusicBrainzRelation[];
  "release-group"?: { id: string };
  "label-info"?: MusicBrainzLabelInfo[];
  media?: MusicBrainzMedium[];
}

interface MusicBrainzReleaseSearch {
  releases?: MusicBrainzRelease[];
}

// A curated subset of MusicBrainz's many url-relationship types, in display order.
const EXTERNAL_LINK_LABELS: Record<string, string> = {
  "official homepage": "Site officiel",
  discogs: "Discogs",
  wikidata: "Wikidata",
  wikipedia: "Wikipedia",
};

/**
 * Albums, from the MusicBrainz API (+ Cover Art Archive for covers) — the
 * sole music source. Free, keyless, but rate-limited (see
 * `MIN_REQUEST_INTERVAL_MS`) and requires an identifying `User-Agent`.
 */
@Injectable()
export class MusicBrainzProvider implements MusicCatalogProvider {
  private readonly logger = new Logger(MusicBrainzProvider.name);
  readonly source = MusicSource.MUSICBRAINZ;

  private readonly throttle = new RequestThrottle(MIN_REQUEST_INTERVAL_MS);

  constructor(
    private readonly configService: ConfigService,
    private readonly quota: QuotaTrackerService,
  ) {}

  async search(query: string): Promise<MusicSummaryDto[]> {
    const params = new URLSearchParams({ query, fmt: "json", limit: "20" });
    const data = await this.get<MusicBrainzReleaseGroupSearch>(
      `/release-group/?${params}`,
    );
    return (data["release-groups"] ?? []).map((rg) => this.toSummary(rg));
  }

  async getDetails(sourceId: string): Promise<ProviderMusicDetails> {
    const params = new URLSearchParams({
      inc: "artist-credits+genres+tags+url-rels",
      fmt: "json",
    });
    const releaseGroup = await this.get<MusicBrainzReleaseGroup>(
      `/release-group/${encodeURIComponent(sourceId)}?${params}`,
      "Album not found on MusicBrainz",
    );

    const primaryArtistId = releaseGroup["artist-credit"]?.[0]?.artist?.id;

    // Cover Art Archive is a separate, unthrottled host — kick it off now and
    // await it last so it overlaps with the throttled MusicBrainz calls below.
    const extraCoverImagesPromise = this.extraCoverImages(releaseGroup.id);

    // Track listing, label and catalog number live on a release (a specific
    // edition), not the release-group — a deluxe edition/reissue can differ.
    const fetchedReleases = await this.releases(releaseGroup.id);
    const releases = fetchedReleases ?? [];
    const release =
      releases.find((r) => r.status === "Official") ?? releases[0] ?? null;
    const tracks = trackListFrom(release);
    const knownDurations = tracks
      .map((t) => t.durationMs)
      .filter((d): d is number => d !== null);
    const labelInfo = release?.["label-info"]?.[0];

    const sameArtistAlbums = await this.sameArtistAlbums(
      releaseGroup.id,
      primaryArtistId,
    );

    return {
      summary: this.toSummary(releaseGroup),
      genres: (releaseGroup.genres ?? []).map((g) => g.name),
      albumType: releaseGroup["primary-type"] ?? null,
      trackCount: tracks.length > 0 ? tracks.length : null,
      releaseDate: toIsoDate(releaseGroup["first-release-date"]),
      releaseDatePrecision: datePrecision(releaseGroup["first-release-date"]),
      sameArtistAlbums,
      externalIds: [
        { source: MusicSource.MUSICBRAINZ, externalId: releaseGroup.id },
      ],
      tags: (releaseGroup.tags ?? []).map((t) => t.name),
      disambiguation: releaseGroup.disambiguation || null,
      externalLinks: externalLinksFrom(releaseGroup),
      listenLinks: listenLinksFrom([
        ...(releaseGroup.relations ?? []),
        ...releases.flatMap((r) => r.relations ?? []),
      ]),
      label: labelInfo?.label?.name ?? null,
      catalogNumber: labelInfo?.["catalog-number"] ?? null,
      tracks,
      totalDurationMs:
        knownDurations.length > 0
          ? knownDurations.reduce((a, b) => a + b, 0)
          : null,
      extraCoverImages: await extraCoverImagesPromise,
      ...(fetchedReleases === null ? { partial: true } : {}),
    };
  }

  /**
   * The release-group's editions, for label/catalog/tracklist data the
   * release-group itself doesn't carry (the "Official" one represents it),
   * and for streaming and store links, which MusicBrainz files per edition.
   */
  private async releases(
    releaseGroupId: string,
  ): Promise<MusicBrainzRelease[] | null> {
    const params = new URLSearchParams({
      "release-group": releaseGroupId,
      inc: "labels+recordings+media+url-rels",
      fmt: "json",
      limit: "25",
    });

    try {
      const data = await this.get<MusicBrainzReleaseSearch>(
        `/release?${params}`,
      );
      return data.releases ?? [];
    } catch (err) {
      this.logger.warn(
        `MusicBrainz editions of ${releaseGroupId} unavailable: ${(err as Error).message}`,
      );
      return null;
    }
  }

  /** The release group a release belongs to — album pages are keyed by it. */
  async releaseGroupIdForRelease(releaseId: string): Promise<string | null> {
    const params = new URLSearchParams({ inc: "release-groups", fmt: "json" });
    const release = await this.get<MusicBrainzRelease>(
      `/release/${encodeURIComponent(releaseId)}?${params}`,
    );
    return release["release-group"]?.id ?? null;
  }

  /**
   * Cover art beyond the main front cover (back, booklet…), from the Cover
   * Art Archive. Best-effort: most albums have no archived extras, and some
   * have none at all (404).
   */
  private async extraCoverImages(
    releaseGroupId: string,
  ): Promise<{ url: string; type: string }[]> {
    const response = await fetch(
      `${COVER_ART_URL}/release-group/${releaseGroupId}`,
      {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
      },
    ).catch(() => null);
    if (!response || !response.ok) return [];

    const data = (await response.json().catch(() => null)) as {
      images?: { image: string; types?: string[] }[];
    } | null;

    return (data?.images ?? [])
      .filter((img) => !(img.types ?? []).includes("Front"))
      .map((img) => ({ url: img.image, type: img.types?.[0] ?? "Autre" }));
  }

  /** Other albums by the primary artist, excluding this one. */
  private async sameArtistAlbums(
    excludeId: string,
    artistId: string | undefined,
  ): Promise<MusicSummaryDto[]> {
    if (!artistId) return [];

    const params = new URLSearchParams({
      artist: artistId,
      type: "album",
      inc: "artist-credits",
      fmt: "json",
      limit: "25",
    });
    const data = await this.get<MusicBrainzReleaseGroupSearch>(
      `/release-group?${params}`,
    ).catch(() => null);
    if (!data) return [];

    return (data["release-groups"] ?? [])
      .filter((rg) => rg.id !== excludeId)
      .map((rg) => this.toSummary(rg))
      .slice(0, MAX_SAME_ARTIST_ALBUMS);
  }

  private toSummary(releaseGroup: MusicBrainzReleaseGroup): MusicSummaryDto {
    return {
      source: MusicSource.MUSICBRAINZ,
      sourceId: releaseGroup.id,
      title: releaseGroup.title,
      artists: (releaseGroup["artist-credit"] ?? []).map(
        (c) => c.artist?.name ?? c.name,
      ),
      year: parseYear(releaseGroup["first-release-date"]),
      // Built directly, not verified — same approach as the other providers'
      // image URLs. 404s on albums with no archived cover; the UI must
      // tolerate a broken image.
      coverUrl: `${COVER_ART_URL}/release-group/${releaseGroup.id}/front-250`,
    };
  }

  /**
   * GET a MusicBrainz path, throttled to respect the ~1 req/s usage policy
   * and identified via a `User-Agent` (required by that same policy). Retries
   * on 503 (MusicBrainz's rate-limit response) with backoff.
   */
  private async get<T>(path: string, notFoundMessage?: string): Promise<T> {
    const contact = this.configService.get<string>("API_CONTACT");
    const url = `${MUSICBRAINZ_API_URL}${path}`;

    return fetchJson<T>(
      url,
      {
        headers: {
          Accept: "application/json",
          "User-Agent": identifyingUserAgent(contact),
        },
      },
      {
        sourceLabel: "MusicBrainz",
        notFoundMessage,
        onAttempt: () => this.quota.record("musicbrainz"),
        beforeAttempt: () => this.throttle.wait(),
        isRetryable: (status) => status === 503,
      },
    );
  }
}

function parseYear(date: string | undefined): number | null {
  const year = Number(date?.slice(0, 4));
  return Number.isInteger(year) ? year : null;
}

/** MusicBrainz date strings are "YYYY", "YYYY-MM" or "YYYY-MM-DD" — reports which. */
function datePrecision(
  date: string | undefined,
): "day" | "month" | "year" | null {
  if (!date) return null;
  if (date.length >= 10) return "day";
  if (date.length >= 7) return "month";
  return "year";
}

/** MusicBrainz dates can be year-only or year-month; both are kept, day/month default to 01. */
function toIsoDate(date: string | undefined): string | null {
  if (!date) return null;
  const padded = date.length === 4 ? `${date}-01-01` : date;
  const parsed = new Date(padded);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function trackListFrom(
  release: MusicBrainzRelease | null,
): { position: number; title: string; durationMs: number | null }[] {
  const tracks = release?.media?.flatMap((m) => m.tracks ?? []) ?? [];
  return tracks.map((t) => ({
    position: t.position,
    title: t.title,
    durationMs: t.length ?? null,
  }));
}

// Matched on the link's host: MusicBrainz files the same service under
// several relationship types ("streaming", "free streaming", "purchase for
// download"…).
const LISTEN_HOSTS: Record<ListenService, RegExp> = {
  SPOTIFY: /^open\.spotify\.com$/,
  APPLE_MUSIC: /^(music|itunes)\.apple\.com$/,
  DEEZER: /(^|\.)deezer\.com$/,
  YOUTUBE_MUSIC: /^music\.youtube\.com$/,
  TIDAL: /^(listen\.)?tidal\.com$/,
  QOBUZ: /(^|\.)qobuz\.com$/,
  BANDCAMP: /(^|\.)bandcamp\.com$/,
  AMAZON_MUSIC: /^(music\.)?amazon\.[a-z.]+$|^www\.amazon\.[a-z.]+$/,
};

/** One link per listening service, in `LISTEN_SERVICES` order. */
function listenLinksFrom(relations: MusicBrainzRelation[]): ListenLinkDto[] {
  const found = new Map<ListenService, string>();

  for (const relation of relations) {
    const url = relation.url?.resource;
    if (!url) continue;
    let host: string;

    try {
      host = new URL(url).hostname.toLowerCase();
    } catch {
      continue;
    }

    const service = LISTEN_SERVICES.find((s) => LISTEN_HOSTS[s].test(host));
    if (service && !found.has(service)) found.set(service, url);
  }

  return LISTEN_SERVICES.flatMap((service) =>
    found.has(service) ? [{ service, url: found.get(service)! }] : [],
  );
}

function externalLinksFrom(
  releaseGroup: MusicBrainzReleaseGroup,
): { label: string; url: string }[] {
  return (releaseGroup.relations ?? [])
    .filter((r) => r.url?.resource && EXTERNAL_LINK_LABELS[r.type])
    .map((r) => ({
      label: EXTERNAL_LINK_LABELS[r.type],
      url: r.url!.resource,
    }));
}
