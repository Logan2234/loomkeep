import {
  ErrorCode,
  type MessageWorkKind,
  type ReviewTargetType,
} from "@loomkeep/shared";
import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import { BookItemService } from "../books/book-item.service";
import { MediaItemService } from "../catalog/media-item.service";
import { AppException } from "../common/app.exception";
import { GameItemService } from "../games/game-item.service";
import { LinkResolverService } from "../links/link-resolver.service";
import { MusicItemService } from "../music/music-item.service";
import { ChatService } from "./chat.service";

/** What a message keeps of a work: enough to draw its card without a lookup. */
export interface WorkCard {
  targetType: ReviewTargetType;
  targetId: string;
  kind: MessageWorkKind;
  title: string;
  imageUrl: string | null;
  href: string;
  year: number | null;
}

/** Cards a message's links turn into, at most. */
const MAX_LINKED_WORKS = 3;
// Links looked at, at most: each unknown one costs a catalogue call.
const MAX_SCANNED_LINKS = 10;

const MEDIA_PATH = /^\/app\/media\/(movie|series|anime)\/([^/?#\s]+)$/;
const DOMAIN_PATH = /^\/app\/(games|books|music)\/([^/?#\s]+)$/;
const LINK = /https?:\/\/[^\s<>]+[^\s<>.,;:!?)\]'"]/g;

/**
 * Work cards: a work page's path becomes the card a message carries. The work
 * is cached like a tracked one (`upsertFromSource`), so the card's target is a
 * real row. 18+ titles never become a card — the other side may not allow
 * them.
 */
@Injectable()
export class ChatWorkService {
  private readonly logger = new Logger(ChatWorkService.name);

  constructor(
    private readonly chat: ChatService,
    private readonly links: LinkResolverService,
    private readonly media: MediaItemService,
    private readonly games: GameItemService,
    private readonly books: BookItemService,
    private readonly music: MusicItemService,
  ) {}

  /** The card for a work attached by hand; 404 when there's none to make. */
  async required(href: string): Promise<WorkCard> {
    const card = await this.card(href).catch(() => null);

    if (!card) {
      throw new AppException(HttpStatus.NOT_FOUND, ErrorCode.ChatWorkNotFound);
    }

    return card;
  }

  /**
   * Turns the work links of a message's text into cards, after the message
   * went out: a link to an uncached work costs a catalogue call, which the
   * sender shouldn't wait for. Never throws.
   */
  refreshLinkedWorks(
    messageId: string,
    text: string,
    skip: string[] = [],
  ): void {
    void this.linkedWorks(text, skip)
      .then((cards) => this.chat.replaceLinkedWorks(messageId, cards))
      .catch((err) =>
        this.logger.warn(`Work cards failed for message ${messageId}`, err),
      );
  }

  private async linkedWorks(text: string, skip: string[]): Promise<WorkCard[]> {
    const urls = [...new Set(text.match(LINK) ?? [])]
      .filter((url) => !skip.includes(url))
      .slice(0, MAX_SCANNED_LINKS);
    const cards: WorkCard[] = [];

    for (const url of urls) {
      if (cards.length === MAX_LINKED_WORKS) break;
      const resolved = await this.links.resolve(url).catch(() => null);
      if (!resolved || cards.some((c) => c.href === resolved.href)) continue;
      const card = await this.card(resolved.href).catch(() => null);
      if (card) cards.push(card);
    }

    return cards;
  }

  private async card(href: string): Promise<WorkCard | null> {
    const media = MEDIA_PATH.exec(href);

    if (media) {
      const type = media[1].toUpperCase() as "MOVIE" | "SERIES" | "ANIME";
      const item = await this.media.upsertFromSource(
        type === "ANIME" ? "ANILIST" : "TMDB",
        media[2],
        type,
      );
      return item.isAdult
        ? null
        : {
            targetType: "MEDIA",
            targetId: item.id,
            kind: type,
            title: item.title,
            imageUrl: item.posterUrl,
            href,
            year: item.releaseDate?.getUTCFullYear() ?? null,
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
    if ("isAdult" in item && item.isAdult) return null;

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
    };
  }
}
