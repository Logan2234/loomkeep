import { getBookDetail } from "#lib/api/books.js";
import { getMediaDetail } from "#lib/api/catalog.js";
import { getGameDetail } from "#lib/api/games.js";
import { resolveLink } from "#lib/api/links.js";
import { getMusicDetail } from "#lib/api/music.js";
import { searchWorks } from "#lib/api/search.js";
import {
  type BookSummaryDto,
  type GameSummaryDto,
  type MediaSummaryDto,
  type MediaType,
  type MessageWorkDto,
  type MusicSummaryDto,
} from "@loomkeep/shared";

export const mediaWork = (media: MediaSummaryDto): MessageWorkDto => ({
  kind: media.type,
  title: media.title,
  imageUrl: media.posterUrl,
  href: `/app/media/${media.type.toLowerCase()}/${media.sourceId}`,
  year: media.year,
  // Only cards in sent messages say whether the viewer tracks the work.
  inLibrary: false,
});

export const gameWork = (game: GameSummaryDto): MessageWorkDto => ({
  kind: "GAME",
  title: game.title,
  imageUrl: game.coverUrl,
  href: `/app/games/${game.sourceId}`,
  year: game.year,
  inLibrary: false,
});

export const bookWork = (book: BookSummaryDto): MessageWorkDto => ({
  kind: "BOOK",
  title: book.title,
  imageUrl: book.coverUrl,
  href: `/app/books/${book.sourceId}`,
  year: book.year,
  inLibrary: false,
});

export const musicWork = (album: MusicSummaryDto): MessageWorkDto => ({
  kind: "MUSIC",
  title: album.title,
  imageUrl: album.coverUrl,
  href: `/app/music/${album.sourceId}`,
  year: album.year,
  inLibrary: false,
});

/**
 * `/reco` and `#`: the works matching `query` across the domains the user
 * keeps on. 18+ titles are left out: they never become a card.
 */
export async function findWorks(
  query: string,
  scope: "local" | "all",
): Promise<MessageWorkDto[]> {
  const { items } = await searchWorks(query, scope);
  return items
    .filter((hit) => !hit.isAdult)
    .map((hit) => ({
      kind: hit.kind,
      title: hit.title,
      imageUrl: hit.imageUrl,
      href: hit.href,
      year: hit.year,
      inLibrary: false,
    }));
}

/** Cards the API makes from a message's links, at most. */
export const MAX_LINKED_WORKS = 3;
/** Links the API looks at, at most — the ones not turned down, in order. */
export const MAX_SCANNED_LINKS = 10;

/** The distinct links of a message being written, in order. */
export function typedLinks(text: string): string[] {
  const links = text.match(/https?:\/\/[^\s<>]+[^\s<>.,;:!?)\]'"]/g) ?? [];
  return [...new Set(links)];
}

const MEDIA_PAGE = /^\/app\/media\/(movie|series|anime)\/([^/?#]+)$/;
const DOMAIN_PAGE = /^\/app\/(games|books|music)\/([^/?#]+)$/;

/**
 * The card a link will turn into once the message is sent, or null. Read
 * live from the catalogue: a link merely typed caches nothing.
 */
export async function previewLinkedWork(
  url: string,
): Promise<MessageWorkDto | null> {
  const { match } = await resolveLink(url);
  if (!match) return null;

  const media = MEDIA_PAGE.exec(match.href);

  if (media) {
    const detail = await getMediaDetail(
      media[1].toUpperCase() as MediaType,
      media[2],
    );
    return detail.isAdult ? null : mediaWork(detail);
  }

  const page = DOMAIN_PAGE.exec(match.href);
  if (!page) return null;
  const [, section, sourceId] = page;

  if (section === "games") {
    const detail = await getGameDetail("igdb", sourceId);
    return detail.isAdult ? null : gameWork(detail);
  }

  if (section === "books") {
    const detail = await getBookDetail("open_library", sourceId);
    return detail.isAdult ? null : bookWork(detail);
  }

  return musicWork(await getMusicDetail("musicbrainz", sourceId));
}
