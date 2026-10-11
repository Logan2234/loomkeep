import type { ListItemTargetType, MessageWorkKind } from "@loomkeep/shared";
import { Injectable } from "@nestjs/common";
import { BookItemService } from "../books/book-item.service";
import { MediaItemService } from "../catalog/media-item.service";
import { GameItemService } from "../games/game-item.service";
import { MusicItemService } from "../music/music-item.service";

/** A work named by its page, cached like a tracked one. */
export interface CachedWork {
  targetType: ListItemTargetType;
  targetId: string;
  kind: MessageWorkKind;
  title: string;
  imageUrl: string | null;
  href: string;
  year: number | null;
  isAdult: boolean;
}

const MEDIA_PATH = /^\/app\/media\/(movie|series|anime)\/([^/?#\s]+)$/;
const DOMAIN_PATH = /^\/app\/(games|books|music)\/([^/?#\s]+)$/;

/**
 * A work page's path (`/app/games/11737`) made into a real row: the work is
 * cached through its domain's `upsertFromSource`, which a message card or a
 * list item can then point at — without the viewer tracking it.
 */
@Injectable()
export class WorkPageService {
  constructor(
    private readonly media: MediaItemService,
    private readonly games: GameItemService,
    private readonly books: BookItemService,
    private readonly music: MusicItemService,
  ) {}

  /** Null for a path that names no work; throws when the catalogue fails. */
  async cache(href: string): Promise<CachedWork | null> {
    const media = MEDIA_PATH.exec(href);

    if (media) {
      const type = media[1].toUpperCase() as "MOVIE" | "SERIES" | "ANIME";
      const item = await this.media.upsertFromSource(
        type === "ANIME" ? "ANILIST" : "TMDB",
        media[2],
        type,
      );
      return {
        targetType: "MEDIA",
        targetId: item.id,
        kind: type,
        title: item.title,
        imageUrl: item.posterUrl,
        href,
        year: item.releaseDate?.getUTCFullYear() ?? null,
        isAdult: item.isAdult,
      };
    }

    const domain = DOMAIN_PATH.exec(href);
    if (!domain) return null;
    const [, section, sourceId] = domain;

    const item =
      section === "games"
        ? await this.games.upsertFromSource("IGDB", sourceId)
        : section === "books"
          ? await this.books.upsertFromSource("OPEN_LIBRARY", sourceId)
          : await this.music.upsertFromSource("MUSICBRAINZ", sourceId);

    const targetType = (
      { games: "GAME", books: "BOOK", music: "MUSIC" } as const
    )[section as "games" | "books" | "music"];
    return {
      targetType,
      targetId: item.id,
      kind: targetType,
      title: item.title,
      imageUrl: item.coverUrl,
      href,
      year: item.releaseDate?.getUTCFullYear() ?? null,
      isAdult: "isAdult" in item && item.isAdult,
    };
  }
}
