import {
  ErrorCode,
  type MessageWorkKind,
  type ReviewTargetType,
} from "@loomkeep/shared";
import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import { AppException } from "../common/app.exception";
import { LinkResolverService } from "../links/link-resolver.service";
import { WorkPageService } from "../links/work-page.service";
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
    private readonly pages: WorkPageService,
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
    const work = await this.pages.cache(href);
    if (!work || work.isAdult) return null;
    return {
      targetType: work.targetType,
      targetId: work.targetId,
      kind: work.kind,
      title: work.title,
      imageUrl: work.imageUrl,
      href: work.href,
      year: work.year,
    };
  }
}
