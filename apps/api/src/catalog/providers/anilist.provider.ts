import {
  BadGatewayException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  CatalogSource,
  MediaSource,
  MediaSummaryDto,
  MediaType,
} from "@loomkeep/shared";
import type { MediaExtrasDto } from "@loomkeep/shared";
import { fetchJson } from "../../common/http.util";
import { QuotaTrackerService } from "../../common/quota-tracker.service";
import type {
  CatalogProvider,
  ProviderEpisode,
  ProviderMediaDetails,
} from "./provider.types";

const GRAPHQL_URL = "https://graphql.anilist.co";

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
      characters(sort: [ROLE, RELEVANCE], perPage: 12) {
        edges { role node { name { full } image { medium } } }
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
  characters?: {
    edges?: {
      role?: string | null;
      node: {
        name: { full?: string | null };
        image?: { medium?: string | null };
      };
    }[];
  };
  recommendations?: {
    nodes?: { mediaRecommendation?: AnilistMedia | null }[];
  };
}

/** Anime, from AniList (GraphQL, no API key needed for public queries). */
@Injectable()
export class AnilistProvider implements CatalogProvider {
  readonly source = CatalogSource.ANILIST;

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
        role: e.role ?? null,
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
              url: `https://anilist.co/anime/${sourceId}`,
            },
          ]
        : [],
      // AniList exposes no screenshot gallery beyond the poster/banner already
      // shown on the page.
      images: [],
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
      { sourceLabel: "AniList", notFoundMessage: "Media not found on AniList" },
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

function stripHtml(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .trim();
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
