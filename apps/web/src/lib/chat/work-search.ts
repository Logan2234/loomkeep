import { getBookDetail, searchBooks } from "#lib/api/books.js";
import { getMediaDetail, searchCatalog } from "#lib/api/catalog.js";
import { getGameDetail, searchGames } from "#lib/api/games.js";
import { resolveLink } from "#lib/api/links.js";
import { getMusicDetail, searchMusic } from "#lib/api/music.js";
import { isDomainEnabled } from "#lib/domains.js";
import {
  Domain,
  type BookSummaryDto,
  type GameSummaryDto,
  type MediaSummaryDto,
  type MediaType,
  type MessageWorkDto,
  type MusicSummaryDto,
} from "@loomkeep/shared";

/** Results kept per domain, so one domain's long list doesn't hide the others. */
const PER_DOMAIN = 3;

export const mediaWork = (media: MediaSummaryDto): MessageWorkDto => ({
  kind: media.type,
  title: media.title,
  imageUrl: media.posterUrl,
  href: `/app/media/${media.type.toLowerCase()}/${media.sourceId}`,
  year: media.year,
});

export const gameWork = (game: GameSummaryDto): MessageWorkDto => ({
  kind: "GAME",
  title: game.title,
  imageUrl: game.coverUrl,
  href: `/app/games/${game.sourceId}`,
  year: game.year,
});

export const bookWork = (book: BookSummaryDto): MessageWorkDto => ({
  kind: "BOOK",
  title: book.title,
  imageUrl: book.coverUrl,
  href: `/app/books/${book.sourceId}`,
  year: book.year,
});

export const musicWork = (album: MusicSummaryDto): MessageWorkDto => ({
  kind: "MUSIC",
  title: album.title,
  imageUrl: album.coverUrl,
  href: `/app/music/${album.sourceId}`,
  year: album.year,
});

/**
 * `/reco`: the works matching `query` across the domains the user keeps on.
 * A domain whose search fails is left out rather than failing the others.
 * 18+ titles are left out too: they never become a card.
 */
export async function searchWorks(query: string): Promise<MessageWorkDto[]> {
  const take = <T extends { title: string; isAdult?: boolean }>(
    items: T[],
    toWork: (item: T) => MessageWorkDto,
  ) =>
    items
      .filter((item) => !item.isAdult)
      .slice(0, PER_DOMAIN)
      .map(toWork);

  const searches: Promise<MessageWorkDto[]>[] = [];

  if (isDomainEnabled(Domain.MEDIA)) {
    searches.push(
      searchCatalog(query).then((page) => take(page.items, mediaWork)),
    );
  }

  if (isDomainEnabled(Domain.GAMES)) {
    searches.push(
      searchGames(query).then(({ results }) => take(results, gameWork)),
    );
  }

  if (isDomainEnabled(Domain.BOOKS)) {
    searches.push(
      searchBooks(query).then(({ results }) => take(results, bookWork)),
    );
  }

  if (isDomainEnabled(Domain.MUSIC)) {
    searches.push(
      searchMusic(query).then(({ results }) => take(results, musicWork)),
    );
  }

  const settled = await Promise.allSettled(searches);
  return settled.flatMap((result) =>
    result.status === "fulfilled" ? result.value : [],
  );
}

/** Links the API turns into cards, at most. */
export const MAX_LINKED_WORKS = 3;

/** The links of a message being written that the composer previews. */
export function typedLinks(text: string): string[] {
  const links = text.match(/https?:\/\/[^\s<>]+[^\s<>.,;:!?)\]'"]/g) ?? [];
  return [...new Set(links)].slice(0, MAX_LINKED_WORKS);
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
