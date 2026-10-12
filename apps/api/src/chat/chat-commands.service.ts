import {
  type BookStatus,
  Domain,
  type EntryStatus,
  ErrorCode,
  type GameStatus,
  MediaType,
  type MessageSagaDto,
  type MessageWhereDto,
  type PickDomain,
  type PickResultDto,
  type SagaDomain,
  type SagaStep,
  type UserSummaryDto,
  type WatchOfferKind,
} from "@loomkeep/shared";
import { HttpStatus, Injectable } from "@nestjs/common";
import { BookSagaService } from "../books/book-saga.service";
import { MediaItemService } from "../catalog/media-item.service";
import { resolveWatchRegion } from "../catalog/watch-region.util";
import { AppException } from "../common/app.exception";
import { resolveWorkHref } from "../common/work-href.util";
import { GameSagaService } from "../games/game-saga.service";
import { SagaService } from "../library/saga.service";
import { PrismaService } from "../prisma/prisma.service";
import { FollowService } from "../social/follow.service";
import { WorkFriendsService } from "../social/work-friends.service";
import { toUserSummaryDto } from "../users/avatar.util";
import { ChatWorkService, type WorkCard } from "./chat-work.service";
import { ChatService, type CommandMessage } from "./chat.service";

const USER_SELECT = {
  id: true,
  username: true,
  displayName: true,
  profileAccess: true,
  avatarUpdatedAt: true,
} as const;

// What a member's status in a saga's work reads as on the card.
const STEP: Record<SagaDomain, Partial<Record<string, SagaStep>>> = {
  MEDIA: {
    COMPLETED: "done",
    UP_TO_DATE: "done",
    WATCHING: "active",
  } satisfies Partial<Record<EntryStatus, SagaStep>>,
  GAMES: {
    COMPLETED: "done",
    PLAYING: "active",
  } satisfies Partial<Record<GameStatus, SagaStep>>,
  BOOKS: {
    READ: "done",
    READING: "active",
  } satisfies Partial<Record<BookStatus, SagaStep>>,
};

// Offers shown on a /where card, in this order; faces only go on the
// subscriptions and free services a member has.
const OFFER_ORDER: WatchOfferKind[] = [
  "flatrate",
  "free",
  "ads",
  "rent",
  "buy",
];
const WITH_MEMBERS = new Set<WatchOfferKind>(["flatrate", "free", "ads"]);

// Works shown rolling by before a /pick lands, at most.
const REEL_SIZE = 8;

// Anime are left out: AniList knows no streaming platform per country.
const MEDIA_PATH = /^\/app\/media\/(movie|series)\/([^/?#\s]+)$/;

type SagaWork = {
  title: string;
  imageUrl: string | null;
  href: string | null;
  upcoming: boolean;
  status: string | null;
};

/**
 * Messages' commands that read more than the chat itself: /pick's draw from a
 * pile, the /saga card with each member's progress, and the /where card with
 * the platforms members share. Each member's library shows only where its
 * visibility lets the viewer see it — the rule of the work page's friends.
 */
@Injectable()
export class ChatCommandsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chat: ChatService,
    private readonly works: ChatWorkService,
    private readonly friends: WorkFriendsService,
    private readonly follow: FollowService,
    private readonly mediaSagas: SagaService,
    private readonly gameSagas: GameSagaService,
    private readonly bookSagas: BookSagaService,
    private readonly media: MediaItemService,
  ) {}

  /** A /pick draw, before it's sent: a work of the pile, and both counts. */
  async draw(
    viewerId: string,
    conversationId: string,
    domain: PickDomain,
    shared: boolean,
  ): Promise<PickResultDto> {
    const pools = await this.pools(viewerId, conversationId, domain);
    const pool = shared ? pools.shared : pools.mine;
    const card = await this.drawCard(domain, [...pool]);
    const reel = card
      ? await this.reel(
          domain,
          [...pool].filter((id) => id !== card.targetId),
        )
      : [];
    return {
      work: card ? { ...card, inLibrary: true } : null,
      reel: reel.map(({ title, imageUrl }) => ({ title, imageUrl })),
      mine: pools.mine.size,
      shared: pools.shared.size,
    };
  }

  /** The work a /pick sends, checked to be in the pile it says it's from. */
  async pickedWork(
    viewerId: string,
    conversationId: string,
    domain: PickDomain,
    shared: boolean,
    href: string,
  ): Promise<{ card: WorkCard; count: number }> {
    const [card, pools] = await Promise.all([
      this.works.required(href),
      this.pools(viewerId, conversationId, domain),
    ]);
    const pool = shared ? pools.shared : pools.mine;

    if (!pool.has(card.targetId)) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.ChatPickNotInPile,
      );
    }

    return { card, count: pool.size };
  }

  /** The /saga sent, checked to be a saga Loomkeep knows. */
  async ensureSaga(domain: SagaDomain, key: string): Promise<void> {
    const known =
      domain === Domain.MEDIA
        ? await this.prisma.saga.count({ where: { key } })
        : domain === Domain.GAMES
          ? await this.prisma.gameSaga.count({ where: { key } })
          : await this.prisma.bookItem.count({ where: { seriesKey: key } });

    if (!known) {
      throw new AppException(HttpStatus.NOT_FOUND, ErrorCode.ChatSagaNotFound);
    }
  }

  /** The /where sent: a film's or a series' card. */
  async whereWork(href: string): Promise<WorkCard> {
    if (!MEDIA_PATH.test(href)) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.ChatWhereNotVideo,
      );
    }

    return this.works.required(href);
  }

  /** A /saga card as the viewer sees it. */
  async saga(viewerId: string, messageId: string): Promise<MessageSagaDto> {
    const message = await this.chat.commandMessage(viewerId, messageId);
    const domain = message.sagaDomain as SagaDomain | null;
    if (!domain || !message.sagaKey) throw notFound();

    const members = await this.visibleMembers(
      viewerId,
      message.memberIds,
      domain,
    );
    const read = await Promise.all(
      members.map((m) => this.readSaga(m.id, domain, message.sagaKey!)),
    );
    const viewerSaga = read[0];
    if (!viewerSaga) throw notFound();

    return {
      domain,
      title: viewerSaga.title,
      works: viewerSaga.works.map(({ status: _, ...work }) => work),
      members: members.map((member, i) => ({
        user: toUserSummaryDto(member),
        mine: member.id === viewerId,
        steps: viewerSaga.works.map((work) => {
          const theirs = read[i]?.works.find((w) => w.href === work.href);
          return STEP[domain][theirs?.status ?? ""] ?? "none";
        }),
      })),
    };
  }

  /** A /where card as the viewer sees it, for their streaming region. */
  async where(
    viewerId: string,
    messageId: string,
    acceptLanguage: string | undefined,
  ): Promise<MessageWhereDto> {
    const message = await this.chat.commandMessage(viewerId, messageId);
    const path = message.whereWork
      ? MEDIA_PATH.exec(message.work?.href ?? "")
      : null;
    if (!path) throw notFound();

    const [, kind, sourceId] = path;
    const type = kind.toUpperCase() as MediaType;
    const [viewer, sharing] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({
        where: { id: viewerId },
        select: { watchRegion: true },
      }),
      this.sharingPlatforms(viewerId, message),
    ]);
    const region = resolveWatchRegion(
      viewer.watchRegion ?? undefined,
      acceptLanguage,
    );
    const { watchProviders } = await this.media
      .providerFor("TMDB")
      .getExtras(sourceId, type, undefined, region);

    const offers = OFFER_ORDER.flatMap((offerKind) =>
      watchProviders[offerKind].map((provider) => ({
        provider,
        kind: offerKind,
        members: WITH_MEMBERS.has(offerKind)
          ? sharing
              .filter((m) => m.providerIds.includes(provider.id))
              .map((m) => m.user)
          : [],
      })),
    );

    return {
      region: watchProviders.region,
      // Stable: within each group, the kinds keep OFFER_ORDER.
      offers: [
        ...offers.filter((offer) => offer.members.length > 0),
        ...offers.filter((offer) => offer.members.length === 0),
      ],
      link: watchProviders.link,
    };
  }

  /**
   * The ids in the viewer's pile, and in every member's pile at once. A
   * member whose library the viewer may not see leaves nothing in common.
   */
  private async pools(
    viewerId: string,
    conversationId: string,
    domain: PickDomain,
  ): Promise<{ mine: Set<string>; shared: Set<string> }> {
    const memberIds = await this.chat.memberIds(viewerId, conversationId);
    const others = memberIds.filter((id) => id !== viewerId);
    const visible = await this.friends.friendsSharingLibrary(
      viewerId,
      others,
      domain,
    );
    const mine = await this.pile(viewerId, domain);

    if (visible.length < others.length) return { mine, shared: new Set() };

    let shared = new Set(mine);

    for (const other of others) {
      const theirs = await this.pile(other, domain);
      shared = new Set([...shared].filter((id) => theirs.has(id)));
    }

    return { mine, shared };
  }

  /** Item ids of a user's pile: what they plan to watch, play, read or hear. */
  private async pile(userId: string, domain: PickDomain): Promise<Set<string>> {
    switch (domain) {
      case Domain.MEDIA: {
        const rows = await this.prisma.libraryEntry.findMany({
          where: { userId, status: "PLANNED", mediaItem: { isAdult: false } },
          select: { mediaItemId: true },
        });
        return new Set(rows.map((r) => r.mediaItemId));
      }

      case Domain.GAMES: {
        const rows = await this.prisma.gameEntry.findMany({
          where: { userId, status: "BACKLOG", gameItem: { isAdult: false } },
          select: { gameItemId: true },
        });
        return new Set(rows.map((r) => r.gameItemId));
      }

      case Domain.BOOKS: {
        const rows = await this.prisma.bookEntry.findMany({
          where: { userId, status: "TO_READ", bookItem: { isAdult: false } },
          select: { bookItemId: true },
        });
        return new Set(rows.map((r) => r.bookItemId));
      }

      case Domain.MUSIC: {
        const rows = await this.prisma.musicEntry.findMany({
          where: { userId, status: "TO_LISTEN" },
          select: { musicItemId: true },
        });
        return new Set(rows.map((r) => r.musicItemId));
      }
    }
  }

  /** A random work of the pool as a card; one that can't become a card is skipped. */
  private async drawCard(
    domain: PickDomain,
    pool: string[],
  ): Promise<WorkCard | null> {
    const targetType = PICK_TARGET[domain];
    const left = [...pool];

    while (left.length > 0) {
      const [id] = left.splice(Math.floor(Math.random() * left.length), 1);
      const href = await resolveWorkHref(this.prisma, targetType, id);
      const card = href
        ? await this.works.required(href).catch(() => null)
        : null;
      if (card) return card;
    }

    return null;
  }

  /** A few other works of the pool, at random, in no particular order. */
  private async reel(domain: PickDomain, pool: string[]): Promise<WorkCard[]> {
    const left = [...pool];
    const sample: string[] = [];

    while (left.length > 0 && sample.length < REEL_SIZE) {
      sample.push(...left.splice(Math.floor(Math.random() * left.length), 1));
    }

    const cards = await Promise.all(
      sample.map(async (id) => {
        const href = await resolveWorkHref(
          this.prisma,
          PICK_TARGET[domain],
          id,
        );
        return href ? this.works.required(href).catch(() => null) : null;
      }),
    );
    return cards.filter((card): card is WorkCard => card !== null);
  }

  /** The viewer, then the other members whose library in `domain` they may see. */
  private async visibleMembers(
    viewerId: string,
    memberIds: string[],
    domain: Domain,
  ) {
    const others = await this.friends.friendsSharingLibrary(
      viewerId,
      memberIds.filter((id) => id !== viewerId),
      domain,
    );
    const viewer = await this.prisma.user.findUniqueOrThrow({
      where: { id: viewerId },
      select: USER_SELECT,
    });
    return [viewer, ...others];
  }

  /** A saga as one member sees it: its works, with their status in each. */
  private async readSaga(
    userId: string,
    domain: SagaDomain,
    key: string,
  ): Promise<{ title: string; works: SagaWork[] } | null> {
    switch (domain) {
      case Domain.MEDIA: {
        const member = await this.prisma.sagaMember.findFirst({
          where: { sagaKey: key },
          orderBy: { position: "asc" },
          select: { type: true, sourceId: true },
        });
        if (!member) return null;
        const saga = await this.mediaSagas.getSaga(
          userId,
          member.type as MediaType,
          member.sourceId,
        );
        return saga
          ? {
              title: saga.title,
              works: saga.members.map((m) => ({
                title: m.title,
                imageUrl: m.posterUrl,
                href: `/app/media/${m.type.toLowerCase()}/${m.sourceId}`,
                upcoming: m.upcoming,
                status: m.status,
              })),
            }
          : null;
      }

      case Domain.GAMES: {
        const member = await this.prisma.gameSagaMember.findFirst({
          where: { sagaKey: key },
          orderBy: { position: "asc" },
          select: { sourceId: true },
        });
        if (!member) return null;
        const saga = await this.gameSagas.getSaga(userId, member.sourceId);
        return saga
          ? {
              title: saga.title,
              works: saga.members.map((m) => ({
                title: m.title,
                imageUrl: m.coverUrl,
                href: `/app/games/${m.sourceId}`,
                upcoming: m.upcoming,
                status: m.status,
              })),
            }
          : null;
      }

      case Domain.BOOKS: {
        const saga = await this.bookSagas.getSaga(userId, key);
        return saga
          ? {
              title: saga.title,
              works: saga.members.map((m) => ({
                title: m.title,
                imageUrl: m.coverUrl,
                href: `/app/books/${m.sourceId}`,
                upcoming: false,
                status: m.status,
              })),
            }
          : null;
      }
    }
  }

  /**
   * The members who share their platforms, and may be shown to the viewer:
   * the viewer, or a friend. Each with the platforms they have.
   */
  private async sharingPlatforms(
    viewerId: string,
    message: CommandMessage,
  ): Promise<{ user: UserSummaryDto; providerIds: number[] }[]> {
    const users = await this.prisma.user.findMany({
      where: { id: { in: message.memberIds }, chatShareWatchProviders: true },
      select: { ...USER_SELECT, watchProviderIds: true },
    });
    const friendIds = new Set(await this.follow.listFriendIds(viewerId));
    return users
      .filter((u) => u.id === viewerId || friendIds.has(u.id))
      .sort((a, b) => Number(b.id === viewerId) - Number(a.id === viewerId))
      .map((u) => ({
        user: toUserSummaryDto(u),
        providerIds: u.watchProviderIds,
      }));
  }
}

const PICK_TARGET: Record<PickDomain, string> = {
  MEDIA: "MEDIA",
  GAMES: "GAME",
  BOOKS: "BOOK",
  MUSIC: "MUSIC",
};

function notFound(): AppException {
  return new AppException(HttpStatus.NOT_FOUND, ErrorCode.ChatMessageNotFound);
}
