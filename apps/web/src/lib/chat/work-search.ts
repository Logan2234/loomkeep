import { searchBooks } from "#lib/api/books.js";
import { searchCatalog } from "#lib/api/catalog.js";
import { searchGames } from "#lib/api/games.js";
import { searchMusic } from "#lib/api/music.js";
import { isDomainEnabled } from "#lib/domains.js";
import {
  Domain,
  type BookSummaryDto,
  type GameSummaryDto,
  type MediaSummaryDto,
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
  const take = <T extends { isAdult?: boolean }>(
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
