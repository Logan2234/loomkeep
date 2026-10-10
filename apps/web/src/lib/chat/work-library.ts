import {
  upsertBookEntry,
  upsertGameEntry,
  upsertLibraryEntry,
  upsertMusicEntry,
} from "#lib/api/client.js";
import {
  Domain,
  type MediaType,
  type MessageWorkDto,
  type MessageWorkKind,
} from "@loomkeep/shared";

const DOMAIN_OF: Record<MessageWorkKind, Domain> = {
  MOVIE: Domain.MEDIA,
  SERIES: Domain.MEDIA,
  ANIME: Domain.MEDIA,
  GAME: Domain.GAMES,
  BOOK: Domain.BOOKS,
  MUSIC: Domain.MUSIC,
};

/** The domain a work belongs to: off, its page can't open. */
export function workDomain(kind: MessageWorkKind): Domain {
  return DOMAIN_OF[kind];
}

const MEDIA_PAGE = /^\/app\/media\/(movie|series|anime)\/([^/?#]+)$/;
const DOMAIN_PAGE = /^\/app\/(games|books|music)\/([^/?#]+)$/;

/**
 * Adds a work from a card to the viewer's library, where each domain starts
 * it: to watch, to play, to read, to listen — as a saga's "Add" does.
 */
export async function addWorkToLibrary(work: MessageWorkDto): Promise<void> {
  const media = MEDIA_PAGE.exec(work.href);

  if (media) {
    const type = media[1].toUpperCase() as MediaType;
    await upsertLibraryEntry({
      source: type === "ANIME" ? "ANILIST" : "TMDB",
      sourceId: media[2],
      type,
      status: "PLANNED",
    });
    return;
  }

  const page = DOMAIN_PAGE.exec(work.href);
  if (!page) return;
  const [, section, sourceId] = page;

  if (section === "games") {
    await upsertGameEntry({ source: "IGDB", sourceId, status: "BACKLOG" });
  } else if (section === "books") {
    await upsertBookEntry({
      source: "OPEN_LIBRARY",
      sourceId,
      status: "TO_READ",
    });
  } else {
    await upsertMusicEntry({
      source: "MUSICBRAINZ",
      sourceId,
      status: "TO_LISTEN",
    });
  }
}
