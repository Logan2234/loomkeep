import {
  upsertBookEntry,
  upsertGameEntry,
  upsertLibraryEntry,
  upsertMusicEntry,
} from "#lib/api/client.js";
import {
  type ListItemTargetType,
  type MessageWorkDto,
  type MessageWorkKind,
} from "@loomkeep/shared/contracts";
import { Domain, type MediaType } from "@loomkeep/shared/enums";

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

/** The list target a work's library entry points at. */
export interface WorkTarget {
  targetType: ListItemTargetType;
  targetId: string;
}

/**
 * Adds a work from a card to the viewer's library, where each domain starts
 * it: to watch, to play, to read, to listen — as a saga's "Add" does. Answers
 * the catalogue item it now tracks, which is what a list holds.
 */
export async function addWorkToLibrary(
  work: Pick<MessageWorkDto, "href">,
): Promise<WorkTarget | null> {
  const media = MEDIA_PAGE.exec(work.href);

  if (media) {
    const type = media[1].toUpperCase() as MediaType;
    const entry = await upsertLibraryEntry({
      source: type === "ANIME" ? "ANILIST" : "TMDB",
      sourceId: media[2],
      type,
      status: "PLANNED",
    });
    return { targetType: "MEDIA", targetId: entry.mediaItem.id };
  }

  const page = DOMAIN_PAGE.exec(work.href);
  if (!page) return null;
  const [, section, sourceId] = page;

  if (section === "games") {
    const entry = await upsertGameEntry({
      source: "IGDB",
      sourceId,
      status: "BACKLOG",
    });
    return { targetType: "GAME", targetId: entry.game.id };
  }

  if (section === "books") {
    const entry = await upsertBookEntry({
      source: "OPEN_LIBRARY",
      sourceId,
      status: "TO_READ",
    });
    return { targetType: "BOOK", targetId: entry.book.id };
  }

  const entry = await upsertMusicEntry({
    source: "MUSICBRAINZ",
    sourceId,
    status: "TO_LISTEN",
  });
  return { targetType: "MUSIC", targetId: entry.album.id };
}
