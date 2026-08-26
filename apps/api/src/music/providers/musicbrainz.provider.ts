import { MusicSource, MusicSummaryDto } from "@loomkeep/shared";
import {
  BadGatewayException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { QuotaTrackerService } from "../../common/quota-tracker.service";
import { RequestThrottle } from "../../common/request-throttle";
import type {
  MusicCatalogProvider,
  ProviderMusicDetails,
} from "./music-provider.types";

const API_URL = "https://musicbrainz.org/ws/2";
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
  bandcamp: "Bandcamp",
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
    let releaseGroup: MusicBrainzReleaseGroup;

    try {
      const params = new URLSearchParams({
        inc: "artist-credits+genres+tags+url-rels",
        fmt: "json",
      });
      releaseGroup = await this.get<MusicBrainzReleaseGroup>(
        `/release-group/${encodeURIComponent(sourceId)}?${params}`,
      );
    } catch {
      throw new NotFoundException("Album not found on MusicBrainz");
    }

    const primaryArtistId = releaseGroup["artist-credit"]?.[0]?.artist?.id;

    // Cover Art Archive is a separate, unthrottled host — kick it off now and
    // await it last so it overlaps with the throttled MusicBrainz calls below.
    const extraCoverImagesPromise = this.extraCoverImages(releaseGroup.id);

    // Track listing, label and catalog number live on a release (a specific
    // edition), not the release-group — a deluxe edition/reissue can differ.
    const release = await this.representativeRelease(releaseGroup.id);
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
      label: labelInfo?.label?.name ?? null,
      catalogNumber: labelInfo?.["catalog-number"] ?? null,
      tracks,
      totalDurationMs:
        knownDurations.length > 0
          ? knownDurations.reduce((a, b) => a + b, 0)
          : null,
      extraCoverImages: await extraCoverImagesPromise,
    };
  }

  /**
   * The release (specific edition) that best represents this release-group,
   * for label/catalog/tracklist data the release-group itself doesn't carry.
   * Prefers the "Official" release when there's a choice.
   */
  private async representativeRelease(
    releaseGroupId: string,
  ): Promise<MusicBrainzRelease | null> {
    const params = new URLSearchParams({
      "release-group": releaseGroupId,
      inc: "labels+recordings+media",
      fmt: "json",
      limit: "25",
    });
    const data = await this.get<MusicBrainzReleaseSearch>(
      `/release?${params}`,
    ).catch(() => null);
    const releases = data?.releases ?? [];
    if (releases.length === 0) return null;
    return releases.find((r) => r.status === "Official") ?? releases[0];
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
      { headers: { Accept: "application/json" } },
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
  private async get<T>(path: string): Promise<T> {
    const contact =
      this.configService.get<string>("API_CONTACT") ??
      "self-hosted, no contact provided";
    const url = `${API_URL}${path}`;

    let lastStatus = 0;

    for (let attempt = 1; attempt <= GET_MAX_ATTEMPTS; attempt++) {
      await this.throttle.wait();

      this.quota.record("musicbrainz");
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": `Loomkeep/1.0 (${contact})`,
        },
      });

      if (response.ok) return (await response.json()) as T;

      lastStatus = response.status;

      if (response.status === 503 && attempt < GET_MAX_ATTEMPTS) {
        await sleep(500 * 2 ** (attempt - 1));
        continue;
      }

      break;
    }

    throw new BadGatewayException(
      `MusicBrainz request failed with status ${lastStatus}`,
    );
  }
}

const GET_MAX_ATTEMPTS = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
