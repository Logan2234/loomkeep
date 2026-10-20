import type {
  CastDetailDto,
  MediaExtrasDto,
  MediaSagaDto,
} from "@loomkeep/shared";
import {
  CatalogSource,
  ErrorCode,
  MediaSummaryDto,
  MediaType,
} from "@loomkeep/shared";
import { HttpStatus, Injectable } from "@nestjs/common";
import { AppException } from "../../common/app.exception";
import { fetchJson, HTTP_TIMEOUT_MS } from "../../common/http.util";
import { QuotaTrackerService } from "../../common/quota-tracker.service";
import { RequestThrottle } from "../../common/request-throttle";
import {
  MAIN_LINE_RELATIONS,
  toCastDetail,
  toExtras,
  toMediaDetails,
  toSagaMember,
  toSummary,
  type AnilistExtras,
  type AnilistFranchiseMedia,
  type AnilistMedia,
  type AnilistStaff,
} from "./anilist.mapper";
import type { CatalogProvider, ProviderMediaDetails } from "./provider.types";

export const ANILIST_GRAPHQL_URL = "https://graphql.anilist.co";

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
      format
      episodes
      duration
      startDate { year month day }
      nextAiringEpisode { episode }
      streamingEpisodes { title thumbnail url site }
      airingSchedule(perPage: 50) {
        pageInfo { hasNextPage }
        nodes { episode airingAt }
      }
      isAdult
      # Only to spot streaming episodes AniList copied across a franchise.
      relations {
        edges {
          node { id type streamingEpisodes { url } }
        }
      }
    }
  }
`;

// The rest of a long show's airing schedule (the details query brings the
// first page).
const SCHEDULE_QUERY = `
  query ($id: Int, $page: Int) {
    Media(id: $id, type: ANIME) {
      airingSchedule(perPage: 50, page: $page) {
        pageInfo { hasNextPage }
        nodes { episode airingAt }
      }
    }
  }
`;

// A long-running show (One Piece) has dozens of schedule pages; past this
// many, the remaining episodes simply keep no broadcast time rather than
// holding a refresh on a string of throttled requests.
const MAX_SCHEDULE_PAGES = 4;

const MAL_ID_QUERY = `
  query ($idMal: Int) {
    Media(idMal: $idMal, type: ANIME) {
      id
      title { romaji english }
      seasonYear
      coverImage { large }
      isAdult
    }
  }
`;

// A user's whole anime list, by chunks: custom lists repeat entries already
// in a status list, so they're left out.
const USER_LIST_QUERY = `
  query ($userName: String, $chunk: Int) {
    MediaListCollection(
      userName: $userName
      type: ANIME
      chunk: $chunk
      perChunk: 500
      forceSingleCompletedList: true
    ) {
      hasNextChunk
      lists {
        isCustomList
        entries {
          status
          score(format: POINT_10_DECIMAL)
          progress
          notes
          startedAt { year month day }
          completedAt { year month day }
          media {
            id
            title { romaji english }
            seasonYear
            coverImage { large }
            isAdult
            format
          }
        }
      }
    }
  }
`;

// 500 entries a chunk: 40 chunks is 20 000 anime, past any real list.
const MAX_USER_LIST_CHUNKS = 40;

/** One entry of an AniList user's anime list, as {@link AnilistProvider.getUserAnimeList} returns it. */
export interface AnilistListEntry {
  /** CURRENT, PLANNING, COMPLETED, DROPPED, PAUSED or REPEATING. */
  status: string;
  /** 0–10 whatever scoring system the user picked; 0 means unscored. */
  score: number | null;
  /** Episodes watched. */
  progress: number | null;
  notes: string | null;
  startedAt: AnilistFuzzyDate | null;
  completedAt: AnilistFuzzyDate | null;
  media: AnilistMedia & { format?: string | null };
}

export interface AnilistFuzzyDate {
  year: number | null;
  month: number | null;
  day: number | null;
}

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
          relationType(version: 2)
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

const FRANCHISE_FIELDS = `
  id
  type
  title { romaji english }
  seasonYear
  format
  episodes
  status
  startDate { year month day }
  coverImage { large }
  isAdult
`;

// One hop of the franchise graph per request: AniList only returns a work's
// direct relations, so the main line is walked from the viewed work outwards.
const FRANCHISE_QUERY = `
  query ($ids: [Int]) {
    Page(perPage: 50) {
      media(id_in: $ids, type: ANIME) {
        ${FRANCHISE_FIELDS}
        relations {
          edges {
            relationType(version: 2)
            node { ${FRANCHISE_FIELDS} }
          }
        }
      }
    }
  }
`;

// Long franchises (One Piece films, Gundam) stop growing past this many hops
// rather than holding the page on a dozen throttled requests.
const MAX_FRANCHISE_HOPS = 8;

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
    const data = await this.query<{ Media: AnilistFranchiseMedia | null }>(
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

    const schedule = media.airingSchedule;

    for (
      let page = 2;
      schedule?.pageInfo?.hasNextPage && page <= MAX_SCHEDULE_PAGES;
      page++
    ) {
      const next = await this.query<{
        Media: Pick<AnilistFranchiseMedia, "airingSchedule"> | null;
      }>(SCHEDULE_QUERY, { id: media.id, page });
      schedule.nodes = [
        ...(schedule.nodes ?? []),
        ...(next.Media?.airingSchedule?.nodes ?? []),
      ];
      schedule.pageInfo = next.Media?.airingSchedule?.pageInfo;
    }

    return toMediaDetails(media);
  }

  /** Resolves a MyAnimeList anime id to its canonical AniList catalogue item. */
  async getSummaryByMalId(malId: string): Promise<MediaSummaryDto | null> {
    const idMal = Number(malId);
    if (!Number.isSafeInteger(idMal) || idMal <= 0) return null;

    const data = await this.query<{ Media: AnilistMedia | null }>(
      MAL_ID_QUERY,
      { idMal },
    );
    return data.Media ? toSummary(data.Media) : null;
  }

  /**
   * A user's anime list, every status list. Not through {@link query}: a
   * missing user and a private list both answer 404, told apart only by
   * the error's own message.
   */
  async getUserAnimeList(userName: string): Promise<AnilistListEntry[]> {
    const entries: AnilistListEntry[] = [];

    for (let chunk = 1; chunk <= MAX_USER_LIST_CHUNKS; chunk++) {
      const page = await this.userListChunk(userName, chunk);

      for (const list of page.lists ?? []) {
        if (!list.isCustomList) entries.push(...list.entries);
      }

      if (!page.hasNextChunk) break;
    }

    return entries;
  }

  private async userListChunk(
    userName: string,
    chunk: number,
  ): Promise<{
    hasNextChunk: boolean;
    lists: { isCustomList: boolean; entries: AnilistListEntry[] }[] | null;
  }> {
    await this.throttle.wait();
    this.quota.record("anilist");

    let response: Response;

    try {
      response = await fetch(ANILIST_GRAPHQL_URL, {
        signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          query: USER_LIST_QUERY,
          variables: { userName, chunk },
        }),
      });
    } catch {
      throw new AppException(
        HttpStatus.BAD_GATEWAY,
        ErrorCode.ImportSourceUnavailable,
      );
    }

    const body = (await response.json().catch(() => null)) as {
      data?: {
        MediaListCollection: {
          hasNextChunk: boolean;
          lists: { isCustomList: boolean; entries: AnilistListEntry[] }[];
        } | null;
      };
      errors?: { message: string }[];
    } | null;
    const messages = (body?.errors ?? []).map((e) => e.message.toLowerCase());

    if (messages.some((message) => message.includes("private"))) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        ErrorCode.ImportAnilistListPrivate,
      );
    }

    if (
      response.status === 404 ||
      messages.some((message) => message.includes("not found"))
    ) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.ImportAnilistUserNotFound,
      );
    }

    const collection = body?.data?.MediaListCollection;

    if (!response.ok || !collection) {
      throw new AppException(
        HttpStatus.BAD_GATEWAY,
        ErrorCode.ImportSourceUnavailable,
        undefined,
        `AniList list request failed with status ${response.status}`,
      );
    }

    return collection;
  }

  // AniList exposes no streaming providers; cast = characters, similar =
  // recommendations. `type` is always ANIME here.
  async getExtras(
    sourceId: string,
    _type: MediaType,
    _lang: string | undefined,
    watchRegion: string,
  ): Promise<MediaExtrasDto> {
    const data = await this.query<{ Media: AnilistExtras | null }>(
      EXTRAS_QUERY,
      { id: Number(sourceId) },
    );
    return toExtras(data.Media, sourceId, watchRegion);
  }

  /**
   * The main line an anime belongs to: every work reachable through
   * prequel/sequel links, oldest first. Null when it stands alone.
   */
  async getSaga(sourceId: string): Promise<MediaSagaDto | null> {
    const found = new Map<number, AnilistMedia>();
    let frontier = [Number(sourceId)];

    for (let hop = 0; hop < MAX_FRANCHISE_HOPS && frontier.length > 0; hop++) {
      const data = await this.query<{
        Page: { media: AnilistFranchiseMedia[] };
      }>(FRANCHISE_QUERY, { ids: frontier });
      const next: number[] = [];

      for (const media of data.Page.media) {
        found.set(media.id, media);

        for (const edge of media.relations?.edges ?? []) {
          const node = edge.node;

          if (
            !node ||
            node.type !== "ANIME" ||
            !MAIN_LINE_RELATIONS.has(edge.relationType ?? "") ||
            found.has(node.id) ||
            next.includes(node.id)
          ) {
            continue;
          }

          found.set(node.id, node);
          next.push(node.id);
        }
      }

      frontier = next;
    }

    if (found.size < 2) return null;

    const members = [...found.values()]
      .map((media) => toSagaMember(media))
      .sort(byRelease);
    return {
      key: `ANILIST:${members[0].sourceId}`,
      title: members[0].title,
      members,
    };
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
    const body = await fetchJson<{
      data?: T;
      errors?: { message: string }[];
    }>(
      ANILIST_GRAPHQL_URL,
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
        onAttempt: () => this.quota.record("anilist"),
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

// Oldest first; a work with no date yet is an announcement and goes last.
function byRelease(
  a: { releaseDate: string | null; sourceId: string },
  b: { releaseDate: string | null; sourceId: string },
): number {
  if (a.releaseDate !== b.releaseDate) {
    if (!a.releaseDate) return 1;
    if (!b.releaseDate) return -1;
    return a.releaseDate < b.releaseDate ? -1 : 1;
  }

  return Number(a.sourceId) - Number(b.sourceId);
}
