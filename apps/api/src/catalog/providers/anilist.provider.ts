import type { MediaExtrasDto } from "@loomkeep/shared";
import {
  CatalogSource,
  MediaSource,
  MediaSummaryDto,
  MediaType,
} from "@loomkeep/shared";
import {
  BadGatewayException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { fetchJson } from "../../common/http.util";
import { QuotaTrackerService } from "../../common/quota-tracker.service";
import { RequestThrottle } from "../../common/request-throttle";
import type {
  CatalogProvider,
  ProviderEpisode,
  ProviderMediaDetails,
} from "./provider.types";

const GRAPHQL_URL = "https://graphql.anilist.co";

// AniList caps usage at 90 requests/minute and imposes a full minute's
// timeout on the offending IP if that's exceeded — steeper than a plain
// slow-down. Spacing calls out (shared instance-wide, same model as
// MusicBrainz) keeps normal usage well clear of that ceiling.
const MIN_REQUEST_INTERVAL_MS = 700;

// If a 429 still happens (e.g. the ban was already triggered by something
// else sharing this IP), don't wait out a minute-long Retry-After inline —
// fail fast so the user gets a clean error instead of a client-side timeout.
const MAX_RETRY_DELAY_MS = 2_000;

const SEARCH_QUERY = `
  query ($search: String, $page: Int) {
    Page(page: $page, perPage: 20) {
      media(search: $search, type: ANIME) {
        id
        title { romaji english }
        seasonYear
        coverImage { large }
        isAdult
      }
    }
  }
`;

const DETAILS_QUERY = `
  query ($id: Int) {
    Media(id: $id, type: ANIME) {
      id
      title { romaji english }
      description(asHtml: false)
      coverImage { extraLarge large }
      bannerImage
      genres
      status
      episodes
      duration
      startDate { year month day }
      nextAiringEpisode { episode }
      streamingEpisodes { title }
      isAdult
    }
  }
`;

const EXTRAS_QUERY = `
  query ($id: Int) {
    Media(id: $id, type: ANIME) {
      averageScore
      siteUrl
      format
      season
      trailer { id site }
      studios(sort: NAME) {
        edges { isMain node { name } }
      }
      tags {
        name
        isMediaSpoiler
        rank
      }
      externalLinks { site url }
      staff(sort: RELEVANCE, perPage: 25) {
        edges { role node { name { full } } }
      }
      characters(sort: [ROLE, RELEVANCE], perPage: 12) {
        edges {
          voiceActors(language: JAPANESE) { name { full } }
          node { name { full } image { medium } }
        }
      }
      relations {
        edges {
          node {
            id
            type
            title { romaji english }
            seasonYear
            coverImage { large }
            isAdult
          }
        }
      }
      recommendations(sort: RATING_DESC, perPage: 12) {
        nodes {
          mediaRecommendation {
            id
            title { romaji english }
            seasonYear
            coverImage { large }
            isAdult
          }
        }
      }
    }
  }
`;

interface AnilistMedia {
  id: number;
  /** AniList's own type ("ANIME" | "MANGA") — only set where needed to filter it (relations). */
  type?: string;
  title: { romaji?: string | null; english?: string | null };
  seasonYear?: number | null;
  coverImage?: { extraLarge?: string | null; large?: string | null };
  description?: string | null;
  bannerImage?: string | null;
  genres?: string[];
  status?: string | null;
  episodes?: number | null;
  /** Average minutes per episode. */
  duration?: number | null;
  startDate?: {
    year?: number | null;
    month?: number | null;
    day?: number | null;
  };
  nextAiringEpisode?: { episode: number } | null;
  streamingEpisodes?: { title?: string | null }[];
  isAdult?: boolean;
}

interface AnilistExtras {
  averageScore?: number | null;
  siteUrl?: string | null;
  format?: string | null;
  season?: string | null;
  trailer?: { id: string; site: string } | null;
  studios?: {
    edges?: { isMain?: boolean; node: { name: string } }[];
  };
  tags?: { name: string; isMediaSpoiler?: boolean; rank?: number | null }[];
  externalLinks?: { site: string; url?: string | null }[];
  staff?: {
    edges?: {
      role?: string | null;
      node: { name: { full?: string | null } };
    }[];
  };
  characters?: {
    edges?: {
      voiceActors?: { name: { full?: string | null } }[];
      node: {
        name: { full?: string | null };
        image?: { medium?: string | null };
      };
    }[];
  };
  relations?: {
    edges?: { node: AnilistMedia | null }[];
  };
  recommendations?: {
    nodes?: { mediaRecommendation?: AnilistMedia | null }[];
  };
}

/** Anime, from AniList (GraphQL, no API key needed for public queries). */
@Injectable()
export class AnilistProvider implements CatalogProvider {
  readonly source = CatalogSource.ANILIST;

  private readonly throttle = new RequestThrottle(MIN_REQUEST_INTERVAL_MS);

  constructor(private readonly quota: QuotaTrackerService) {}

  // AniList only serves anime, so the `type` filter is irrelevant here.
  async search(
    query: string,
    _type?: MediaType,
    page = 1,
  ): Promise<MediaSummaryDto[]> {
    const data = await this.query<{ Page: { media: AnilistMedia[] } }>(
      SEARCH_QUERY,
      {
        search: query,
        page,
      },
    );
    return data.Page.media.map((media) => this.toSummary(media));
  }

  async getDetails(sourceId: string): Promise<ProviderMediaDetails> {
    const data = await this.query<{ Media: AnilistMedia | null }>(
      DETAILS_QUERY,
      {
        id: Number(sourceId),
      },
    );
    const media = data.Media;

    if (!media) {
      throw new NotFoundException("Media not found on AniList");
    }

    return {
      summary: this.toSummary(media),
      overview: media.description ? stripHtml(media.description) : null,
      backdropUrl: media.bannerImage ?? null,
      genres: media.genres ?? [],
      status: media.status ?? null,
      releaseDate: toIsoDate(media.startDate),
      runtimeMin: media.duration ?? null,
      externalIds: [
        { source: MediaSource.ANILIST, externalId: String(media.id) },
      ],
      seasons: [{ number: 1, title: null, episodes: buildEpisodes(media) }],
    };
  }

  // AniList exposes no streaming providers; cast = characters, similar =
  // recommendations. `type` is always ANIME here.
  async getExtras(sourceId: string): Promise<MediaExtrasDto> {
    const data = await this.query<{ Media: AnilistExtras | null }>(
      EXTRAS_QUERY,
      { id: Number(sourceId) },
    );
    const media = data.Media;
    return {
      watchProviders: { flatrate: [], rent: [], buy: [], link: null },
      cast: (media?.characters?.edges ?? []).map((e) => ({
        // AniList characters have no person detail page here, so they are not
        // clickable — id stays null (see CastMemberDto).
        id: null,
        name: e.node.name.full ?? "?",
        // The Japanese voice actor stands in for TMDB's "character played by
        // an actor" pairing — more useful here than the character's own
        // MAIN/SUPPORTING role tag.
        role: e.voiceActors?.[0]?.name.full ?? null,
        photoUrl: e.node.image?.medium ?? null,
      })),
      similar: (media?.recommendations?.nodes ?? [])
        .map((n) => n.mediaRecommendation)
        .filter((m): m is AnilistMedia => m !== null)
        .map((m) => this.toSummary(m)),
      ratings: media?.averageScore
        ? [
            {
              source: "AniList",
              score: `${media.averageScore}%`,
              url: media.siteUrl ?? `https://anilist.co/anime/${sourceId}`,
            },
          ]
        : [],
      // AniList exposes no screenshot gallery beyond the poster/banner already
      // shown on the page.
      images: [],
      // AniList has neither a tagline nor an official age certification.
      tagline: null,
      directors: anilistDirectors(media?.staff),
      trailerVideoId: anilistTrailer(media?.trailer),
      contentRating: null,
      studios: anilistStudios(media?.studios),
      format: media?.format ?? null,
      season: media?.season ?? null,
      // Only anime-type relations: AniList also links manga/light-novel
      // sources, which have no page of their own in Loomkeep.
      relations: (media?.relations?.edges ?? [])
        .map((e) => e.node)
        .filter((n): n is AnilistMedia => n?.type === "ANIME")
        .map((n) => this.toSummary(n)),
      externalLinks: (media?.externalLinks ?? [])
        .filter((l): l is { site: string; url: string } => !!l.url)
        .map((l) => ({ name: l.site, url: l.url })),
      tags: (media?.tags ?? [])
        .filter((t) => !t.isMediaSpoiler)
        // The API doesn't support server-side sorting on this field.
        .sort((a, b) => (b.rank ?? 0) - (a.rank ?? 0))
        .slice(0, 10)
        .map((t) => t.name),
    };
  }

  private toSummary(media: AnilistMedia): MediaSummaryDto {
    return {
      source: CatalogSource.ANILIST,
      sourceId: String(media.id),
      type: MediaType.ANIME,
      title:
        media.title.english ?? media.title.romaji ?? `AniList #${media.id}`,
      year: media.seasonYear ?? null,
      posterUrl:
        media.coverImage?.extraLarge ?? media.coverImage?.large ?? null,
      isAdult: media.isAdult ?? false,
    };
  }

  private async query<T>(
    query: string,
    variables: Record<string, unknown>,
  ): Promise<T> {
    await this.throttle.wait();
    this.quota.record("anilist");
    const body = await fetchJson<{
      data?: T;
      errors?: { message: string }[];
    }>(
      GRAPHQL_URL,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ query, variables }),
      },
      {
        sourceLabel: "AniList",
        notFoundMessage: "Media not found on AniList",
        maxRetryDelayMs: MAX_RETRY_DELAY_MS,
      },
    );

    if (body.errors?.length || !body.data) {
      // AniList returns 200 with an errors array for "not found" on some queries.
      if (
        body.errors?.some((e) => e.message.toLowerCase().includes("not found"))
      ) {
        throw new NotFoundException("Media not found on AniList");
      }

      throw new BadGatewayException(
        body.errors?.[0]?.message ?? "AniList returned no data",
      );
    }

    return body.data;
  }
}

/**
 * AniList has no full per-episode listing: it exposes an episode count and,
 * for some titles, streaming episode names. Episodes are generated 1..N as a
 * single season, with names when available.
 */
function buildEpisodes(media: AnilistMedia): ProviderEpisode[] {
  const aired = media.nextAiringEpisode
    ? media.nextAiringEpisode.episode - 1
    : null;
  const count = media.episodes ?? aired ?? media.streamingEpisodes?.length ?? 0;

  return Array.from({ length: count }, (_, index) => ({
    number: index + 1,
    title: media.streamingEpisodes?.[index]?.title ?? null,
    airDate: null,
  }));
}

// Loops the tag-stripping pass until stable — a single pass can leave a tag
// exposed on a crafted nested/malformed input (e.g. "<<b>script>"), which is
// exactly what CodeQL's "incomplete multi-character sanitization" check flags.
function stripHtml(text: string): string {
  let result = text.replace(/<br\s*\/?>/gi, "\n");
  let previous: string;

  do {
    previous = result;
    result = previous.replace(/<[^>]+>/g, "");
  } while (result !== previous);

  return result.trim();
}

/** Staff credited with the exact role "Director" (case-insensitive). */
function anilistDirectors(staff: AnilistExtras["staff"]): string[] {
  const names = (staff?.edges ?? [])
    .filter((e) => e.role?.trim().toLowerCase() === "director")
    .map((e) => e.node.name.full)
    .filter((n): n is string => !!n);
  return [...new Set(names)];
}

/** YouTube trailers only — the only site the lightbox knows how to embed. */
function anilistTrailer(trailer: AnilistExtras["trailer"]): string | null {
  return trailer?.site === "youtube" ? trailer.id : null;
}

function anilistStudios(studios: AnilistExtras["studios"]): string[] {
  return (studios?.edges ?? []).filter((e) => e.isMain).map((e) => e.node.name);
}

function toIsoDate(date?: {
  year?: number | null;
  month?: number | null;
  day?: number | null;
}) {
  if (!date?.year) {
    return null;
  }

  const month = String(date.month ?? 1).padStart(2, "0");
  const day = String(date.day ?? 1).padStart(2, "0");
  return `${date.year}-${month}-${day}`;
}
