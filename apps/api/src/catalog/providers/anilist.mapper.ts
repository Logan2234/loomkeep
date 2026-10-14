import type {
  CastDetailDto,
  MediaExtrasDto,
  SagaMemberDto,
} from "@loomkeep/shared";
import {
  CatalogSource,
  MediaSource,
  MediaSummaryDto,
  MediaType,
} from "@loomkeep/shared";
import { stripTags } from "../../common/text.util";
import type { ProviderEpisode, ProviderMediaDetails } from "./provider.types";

export interface AnilistMedia {
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
  format?: string | null;
  episodes?: number | null;
  /** Average minutes per episode. */
  duration?: number | null;
  startDate?: {
    year?: number | null;
    month?: number | null;
    day?: number | null;
  };
  nextAiringEpisode?: { episode: number } | null;
  streamingEpisodes?: {
    title?: string | null;
    thumbnail?: string | null;
    url?: string | null;
    site?: string | null;
  }[];
  /** Broadcast times, `airingAt` in Unix seconds. Can start mid-run. */
  airingSchedule?: {
    pageInfo?: { hasNextPage?: boolean | null } | null;
    nodes?: { episode: number; airingAt: number }[] | null;
  } | null;
  isAdult?: boolean;
}

export interface AnilistExtras {
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
      voiceActors?: {
        id: number;
        name: { full?: string | null };
        image?: { medium?: string | null };
      }[];
      node: {
        name: { full?: string | null };
        image?: { medium?: string | null };
      };
    }[];
  };
  relations?: {
    edges?: AnilistRelationEdge[];
  };
  recommendations?: {
    nodes?: { mediaRecommendation?: AnilistMedia | null }[];
  };
}

interface AnilistRelationEdge {
  /** SEQUEL, PREQUEL, SIDE_STORY, SPIN_OFF, ALTERNATIVE… */
  relationType?: string | null;
  node: AnilistMedia | null;
}

/** A franchise node, with the works it links to. */
export interface AnilistFranchiseMedia extends AnilistMedia {
  relations?: { edges?: AnilistRelationEdge[] };
}

/** Relations that continue the story itself: the saga's main line. */
export const MAIN_LINE_RELATIONS = new Set(["SEQUEL", "PREQUEL"]);

export interface AnilistStaff {
  name: { full?: string | null };
  image?: { large?: string | null };
  description?: string | null;
  dateOfBirth?: { year?: number | null } | null;
  dateOfDeath?: { year?: number | null } | null;
  homeTown?: string | null;
  characterMedia?: { nodes?: AnilistMedia[] };
}

export function toSummary(media: AnilistMedia): MediaSummaryDto {
  return {
    source: CatalogSource.ANILIST,
    sourceId: String(media.id),
    type: MediaType.ANIME,
    title: media.title.english ?? media.title.romaji ?? `AniList #${media.id}`,
    year: media.seasonYear ?? null,
    posterUrl: media.coverImage?.extraLarge ?? media.coverImage?.large ?? null,
    isAdult: media.isAdult ?? false,
  };
}

export function toSagaMember(media: AnilistMedia): SagaMemberDto {
  return {
    ...toSummary(media),
    releaseDate: toIsoDate(media.startDate),
    format: media.format ?? null,
    episodes: media.episodes ?? null,
    upcoming: media.status === "NOT_YET_RELEASED",
    status: null,
  };
}

export function toMediaDetails(
  media: AnilistFranchiseMedia,
): ProviderMediaDetails {
  const summary = toSummary(media);
  return {
    summary,
    overview: media.description
      ? stripTags(media.description, {
          brToNewline: true,
          stripEmptyTags: false,
        })
      : null,
    backdropUrl: media.bannerImage ?? null,
    genres: media.genres ?? [],
    status: media.status ?? null,
    format: media.format ?? null,
    releaseDate: toIsoDate(media.startDate),
    runtimeMin: media.duration ?? null,
    externalIds: [
      { source: MediaSource.ANILIST, externalId: String(media.id) },
    ],
    // Each AniList entry is one cour/season of its own (sequels are separate
    // entries, linked through the saga), so its single generated season
    // carries the entry's own name rather than a misleading "Season 1".
    seasons: [
      {
        number: 1,
        title: summary.title,
        // The entry's own synopsis and cover already show on the page; a
        // season-level copy would only repeat them.
        overview: null,
        posterUrl: null,
        airDate: toIsoDate(media.startDate),
        voteAverage: null,
        episodes: buildEpisodes(media),
      },
    ],
  };
}

export function toExtras(
  media: AnilistExtras | null,
  sourceId: string,
  watchRegion: string,
): MediaExtrasDto {
  return {
    // AniList's streaming links name no country, so they can't say where a
    // title is available: they stay in `externalLinks` only.
    watchProviders: {
      region: watchRegion,
      flatrate: [],
      free: [],
      ads: [],
      rent: [],
      buy: [],
      link: null,
    },
    cast: (media?.characters?.edges ?? []).map((e) => {
      // Mirrors TMDB's actor→character pairing: the Japanese voice actor is
      // the named/pictured person, the character is the role underneath.
      // Falls back to the character alone when no voice actor is credited.
      const va = e.voiceActors?.[0];
      const vaPhoto = va?.image?.medium ?? null;
      const characterPhoto = e.node.image?.medium ?? null;
      return {
        // Clickable (opens the AniList staff modal) only when a voice
        // actor is credited — plain characters have no detail page.
        id: va ? String(va.id) : null,
        name: va?.name.full ?? e.node.name.full ?? "?",
        role: va ? (e.node.name.full ?? null) : null,
        photoUrl: vaPhoto ?? characterPhoto,
        // Only worth splitting the card when there are two distinct
        // photos to show.
        characterPhotoUrl:
          va && vaPhoto && characterPhoto ? characterPhoto : null,
      };
    }),
    similar: (media?.recommendations?.nodes ?? [])
      .map((n) => n.mediaRecommendation)
      .filter((m): m is AnilistMedia => m !== null)
      .map((m) => toSummary(m)),
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
    // sources, which have no page of their own in Loomkeep. Prequels and
    // sequels belong to the saga block instead: these are the side works.
    relations: (media?.relations?.edges ?? [])
      .filter((e) => !MAIN_LINE_RELATIONS.has(e.relationType ?? ""))
      .map((e) => e.node)
      .filter((n): n is AnilistMedia => n?.type === "ANIME")
      .map((n) => toSummary(n)),
    externalLinks: (media?.externalLinks ?? [])
      .filter((l): l is { site: string; url: string } => !!l.url)
      // AniList sometimes lists the same page twice.
      .filter((l, i, links) => links.findIndex((o) => o.url === l.url) === i)
      .map((l) => ({ name: l.site, url: l.url })),
    tags: (media?.tags ?? [])
      .filter((t) => !t.isMediaSpoiler)
      // The API doesn't support server-side sorting on this field.
      .sort((a, b) => (b.rank ?? 0) - (a.rank ?? 0))
      .slice(0, 10)
      .map((t) => t.name),
  };
}

export function toCastDetail(staff: AnilistStaff): CastDetailDto {
  return {
    name: staff.name.full ?? "?",
    photoUrl: staff.image?.large ?? null,
    subtitle: staffSubtitle(staff),
    description: staff.description
      ? stripAnilistMarkdown(staff.description)
      : null,
    // Anime only: characterMedia can also include manga/light-novel roles,
    // which have no page of their own in Loomkeep.
    knownFor: (staff.characterMedia?.nodes ?? [])
      .filter((m): m is AnilistMedia => m?.type === "ANIME")
      .map((m) => toSummary(m)),
    // AniList has no IMDb/Wikidata ids, and no personal homepage distinct
    // from its own profile page.
    imdbId: null,
    wikidataId: null,
    homepage: null,
  };
}

/**
 * AniList has no full per-episode listing: it exposes an episode count, an
 * airing schedule (broadcast times, often only part of the run) and, for
 * some titles, streaming episodes (name, thumbnail, link). Episodes are
 * generated 1..N as a single season, with whatever of those exists.
 */
function buildEpisodes(media: AnilistFranchiseMedia): ProviderEpisode[] {
  const aired = media.nextAiringEpisode
    ? media.nextAiringEpisode.episode - 1
    : null;
  const count = media.episodes ?? aired ?? media.streamingEpisodes?.length ?? 0;
  const streaming = sharesStreamingEpisodes(media)
    ? new Map<number, StreamingEpisode>()
    : streamingEpisodesByNumber(media.streamingEpisodes ?? [], count);
  const airingAt = new Map(
    (media.airingSchedule?.nodes ?? []).map((node) => [
      node.episode,
      node.airingAt,
    ]),
  );

  return Array.from({ length: count }, (_, index) => {
    const number = index + 1;
    const stream = streaming.get(number);
    const airing = airingAt.get(number);
    return {
      number,
      title: stream?.name ?? null,
      airDate: airing ? new Date(airing * 1000).toISOString() : null,
      runtimeMin: media.duration ?? null,
      overview: null,
      stillUrl: stream?.thumbnail ?? null,
      voteAverage: null,
      voteCount: null,
      episodeType: null,
      streamingUrl: stream?.url ?? null,
      streamingSite: stream?.url ? (stream.site ?? null) : null,
    };
  });
}

interface StreamingEpisode {
  name: string | null;
  thumbnail: string | null;
  url: string | null;
  site: string | null;
}

/**
 * AniList fills streaming episodes from Crunchyroll, which lists a whole
 * franchise as one series — so for some shows every season's entry carries
 * the same episodes, all of them from one season (every Dr. STONE entry lists
 * New World's). Those can't be told apart from the right ones on their own,
 * so an entry sharing any streaming episode with a related anime gets no
 * names at all rather than another season's.
 */
function sharesStreamingEpisodes(media: AnilistFranchiseMedia): boolean {
  const urls = new Set(
    (media.streamingEpisodes ?? []).flatMap(({ url }) => (url ? [url] : [])),
  );
  if (urls.size === 0) return false;

  return (media.relations?.edges ?? []).some(
    ({ node }) =>
      node?.type === "ANIME" &&
      node.id !== media.id &&
      (node.streamingEpisodes ?? []).some(({ url }) => !!url && urls.has(url)),
  );
}

// "Episode 16 - Medusa Mechanism" — the shape AniList's streaming episodes
// (Crunchyroll's listing) use. The name part is optional.
const STREAMING_TITLE = /^\s*Episode\s+(\d+)\s*(?:[-–—:]\s*(.*))?$/i;

/**
 * Keys streaming episodes (name, thumbnail, link) by the number written in
 * their title, never by their position: AniList returns them in no
 * guaranteed order (often newest first). One with no readable number is
 * dropped — nothing beats the wrong episode's. A later cour listed under its
 * own AniList entry often keeps the show's absolute numbering (episodes
 * 13–24 for a 12-episode entry), so when the numbers overshoot the count
 * they're shifted to start at 1.
 */
function streamingEpisodesByNumber(
  streamingEpisodes: NonNullable<AnilistMedia["streamingEpisodes"]>,
  count: number,
): Map<number, StreamingEpisode> {
  const parsed: ({ number: number } & StreamingEpisode)[] = [];

  for (const { title, thumbnail, url, site } of streamingEpisodes) {
    const match = title ? STREAMING_TITLE.exec(title) : null;
    if (!match) continue;
    parsed.push({
      number: Number(match[1]),
      name: match[2]?.trim() || null,
      thumbnail: thumbnail || null,
      url: url || null,
      site: site || null,
    });
  }

  if (parsed.length === 0) return new Map();

  const numbers = parsed.map((episode) => episode.number);
  const offset = Math.max(...numbers) > count ? Math.min(...numbers) - 1 : 0;

  const byNumber = new Map<number, StreamingEpisode>();

  for (const { number, ...episode } of parsed) {
    const kept = byNumber.get(number - offset);

    if (!kept || (!kept.name && episode.name)) {
      byNumber.set(number - offset, episode);
    }
  }

  return byNumber;
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

/** "1990 – 2020 · Oita" from whatever birth/death year and hometown exist. */
function staffSubtitle(staff: AnilistStaff): string | null {
  const birthYear = staff.dateOfBirth?.year;
  const deathYear = staff.dateOfDeath?.year;
  const years = birthYear
    ? deathYear
      ? `${birthYear} – ${deathYear}`
      : String(birthYear)
    : null;
  return [years, staff.homeTown].filter(Boolean).join(" · ") || null;
}

// AniList bios use a light markdown dialect (links, bold, strikethrough);
// rendered as plain text, so strip the markup rather than pull in a
// markdown renderer for this one field.
function stripAnilistMarkdown(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1")
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
