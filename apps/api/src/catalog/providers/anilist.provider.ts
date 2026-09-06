import type { CastDetailDto, MediaExtrasDto } from "@loomkeep/shared";
import {
  CatalogSource,
  ErrorCode,
  MediaSummaryDto,
  MediaType,
} from "@loomkeep/shared";
import { HttpStatus, Injectable } from "@nestjs/common";
import { AppException } from "../../common/app.exception";
import { fetchJson } from "../../common/http.util";
import { QuotaTrackerService } from "../../common/quota-tracker.service";
import { RequestThrottle } from "../../common/request-throttle";
import {
  toCastDetail,
  toExtras,
  toMediaDetails,
  toSummary,
  type AnilistExtras,
  type AnilistMedia,
  type AnilistStaff,
} from "./anilist.mapper";
import type { CatalogProvider, ProviderMediaDetails } from "./provider.types";

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
          voiceActors(language: JAPANESE) { id name { full } image { medium } }
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

const STAFF_QUERY = `
  query ($id: Int) {
    Staff(id: $id) {
      name { full }
      image { large }
      description(asHtml: false)
      dateOfBirth { year }
      dateOfDeath { year }
      homeTown
      characterMedia(sort: POPULARITY_DESC, perPage: 12) {
        nodes {
          id
          type
          title { romaji english }
          seasonYear
          coverImage { large }
          isAdult
        }
      }
    }
  }
`;

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
    return data.Page.media.map((media) => toSummary(media));
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
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.CatalogItemNotFound,
      );
    }

    return toMediaDetails(media);
  }

  // AniList exposes no streaming providers; cast = characters, similar =
  // recommendations. `type` is always ANIME here.
  async getExtras(sourceId: string): Promise<MediaExtrasDto> {
    const data = await this.query<{ Media: AnilistExtras | null }>(
      EXTRAS_QUERY,
      { id: Number(sourceId) },
    );
    return toExtras(data.Media, sourceId);
  }

  /** Live detail of an AniList staff member (voice actor) for the cast modal. */
  async getPerson(id: string): Promise<CastDetailDto> {
    const data = await this.query<{ Staff: AnilistStaff | null }>(STAFF_QUERY, {
      id: Number(id),
    });
    const staff = data.Staff;

    if (!staff) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.CatalogPersonNotFound,
      );
    }

    return toCastDetail(staff);
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
        throw new AppException(
          HttpStatus.NOT_FOUND,
          ErrorCode.CatalogItemNotFound,
        );
      }

      throw new AppException(
        HttpStatus.BAD_GATEWAY,
        ErrorCode.CatalogProviderUnavailable,
        undefined,
        body.errors?.[0]?.message ?? "AniList returned no data",
      );
    }

    return body.data;
  }
}
