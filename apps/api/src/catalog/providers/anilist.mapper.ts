import type { CastDetailDto, MediaExtrasDto } from "@loomkeep/shared";
import {
  CatalogSource,
  MediaSource,
  MediaSummaryDto,
  MediaType,
} from "@loomkeep/shared";
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
    edges?: { node: AnilistMedia | null }[];
  };
  recommendations?: {
    nodes?: { mediaRecommendation?: AnilistMedia | null }[];
  };
}

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

export function toMediaDetails(media: AnilistMedia): ProviderMediaDetails {
  return {
    summary: toSummary(media),
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

export function toExtras(
  media: AnilistExtras | null,
  sourceId: string,
): MediaExtrasDto {
  return {
    watchProviders: { flatrate: [], rent: [], buy: [], link: null },
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
    // sources, which have no page of their own in Loomkeep.
    relations: (media?.relations?.edges ?? [])
      .map((e) => e.node)
      .filter((n): n is AnilistMedia => n?.type === "ANIME")
      .map((n) => toSummary(n)),
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
