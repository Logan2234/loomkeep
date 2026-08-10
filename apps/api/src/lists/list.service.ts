import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  ActivityType,
  type ListDetailDto,
  type ListDto,
  type ListItemDto,
  type ListItemTargetType,
  type ListVisibility,
  type MyListDto,
  type ReviewTargetSummaryDto,
  type UserSummaryDto,
} from "@loomkeep/shared";
import { canonicalExternalId } from "../common/external-id.util";
import { PrismaService } from "../prisma/prisma.service";
import { ActivityService } from "../social/activity.service";
import { resolveOwnVisibility } from "../social/visibility.util";
import { VisibilityService } from "../social/visibility.service";
import { toUserSummaryDto } from "../users/avatar.util";
import type { AddListItemBody } from "./dto/add-list-item.dto";
import type { CreateListBody } from "./dto/create-list.dto";
import type { UpdateListBody } from "./dto/update-list.dto";

const AUTHOR_SELECT = {
  id: true,
  username: true,
  displayName: true,
  profileAccess: true,
  avatarUpdatedAt: true,
} as const;

/** How many items feed the collage preview (1 = full cover, 2-4 = quadrants). */
const PREVIEW_ITEM_COUNT = 4;

type ListRow = {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  kind: string;
  visibility: string;
  createdAt: Date;
  updatedAt: Date;
};

type ListItemRow = {
  id: string;
  targetType: string;
  targetId: string;
  position: number;
  addedAt: Date;
};

@Injectable()
export class ListService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly visibility: VisibilityService,
    private readonly activity: ActivityService,
  ) {}

  private toDto(row: ListRow, author: UserSummaryDto): ListDto {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      kind: row.kind as ListDto["kind"],
      visibility: row.visibility as ListVisibility,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      author,
    };
  }

  private async author(userId: string): Promise<UserSummaryDto> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: AUTHOR_SELECT,
    });
    return toUserSummaryDto(user);
  }

  /** Creates a list. Not social-gated — managing your own lists always works. */
  async create(userId: string, dto: CreateListBody): Promise<ListDto> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { defaultListVisibility: true, profileAccess: true },
    });
    const requested = dto.visibility ?? user.defaultListVisibility;
    // A Figurant can create lists but never share them — clamp regardless of
    // what was requested or their configured default.
    const visibility = user.profileAccess === "GHOST" ? "PRIVATE" : requested;

    const row = await this.prisma.list.create({
      data: {
        userId,
        title: dto.title,
        description: dto.description ?? null,
        kind: dto.kind,
        visibility,
      },
    });

    await this.activity.emit({
      userId,
      type: ActivityType.LIST_CREATED,
      domain: "LISTS",
      targetType: "LIST",
      targetId: row.id,
      homeFeed: false,
    });

    return this.toDto(row, await this.author(userId));
  }

  /** Updates the user's own list. Emits LIST_SHARED on a PRIVATE→shared transition. */
  async update(
    userId: string,
    id: string,
    dto: UpdateListBody,
  ): Promise<ListDto> {
    const existing = await this.ownList(userId, id);

    let visibility = dto.visibility;

    if (visibility && visibility !== "PRIVATE") {
      const user = await this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { profileAccess: true },
      });
      // A Figurant can't share a list — clamp even if they already own one
      // that predates their switch to Figurant (already downgraded then, but
      // this also covers re-sharing attempts while still Figurant).
      if (user.profileAccess === "GHOST") visibility = "PRIVATE";
    }

    const row = await this.prisma.list.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        visibility,
        // RANKED/COLLECTION share the same storage (items + position) —
        // switching kind is a display-only change, no item migration needed.
        kind: dto.kind,
      },
    });

    if (
      dto.visibility &&
      dto.visibility !== "PRIVATE" &&
      existing.visibility === "PRIVATE"
    ) {
      await this.activity.emit({
        userId,
        type: ActivityType.LIST_SHARED,
        domain: "LISTS",
        targetType: "LIST",
        targetId: row.id,
        homeFeed: true,
      });
    }

    return this.toDto(row, await this.author(userId));
  }

  async remove(userId: string, id: string): Promise<void> {
    const { count } = await this.prisma.list.deleteMany({
      where: { id, userId },
    });
    if (count === 0) throw new NotFoundException();
  }

  /** Every list the current user owns (newest-updated first), with a preview. */
  async listMine(userId: string): Promise<MyListDto[]> {
    const rows = await this.prisma.list.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      include: {
        items: { orderBy: { position: "asc" }, take: PREVIEW_ITEM_COUNT },
        _count: { select: { items: true } },
      },
    });

    const [author, previews] = await Promise.all([
      this.author(userId),
      this.buildPreviews(rows),
    ]);

    return rows.map((r) => ({
      ...this.toDto(r, author),
      itemCount: r._count.items,
      previewImageUrls: previews.get(r.id) ?? [],
    }));
  }

  /** The user's own list with its items, ordered — for the edit screen. */
  async getOwn(userId: string, id: string): Promise<ListDetailDto> {
    await this.ownList(userId, id);
    return this.detail(id);
  }

  /**
   * A list as seen by `viewerId` — own-visibility gated like Review (own
   * scope, capped by the owner's profileAccess, never facet-derived). Returns
   * null when not visible (caller 404s), so a stranger probing ids learns
   * nothing.
   */
  async getForViewer(
    viewerId: string,
    id: string,
  ): Promise<ListDetailDto | null> {
    const row = await this.prisma.list.findUnique({
      where: { id },
      include: { user: { select: { id: true, profileAccess: true } } },
    });
    if (!row) return null;

    if (row.userId !== viewerId) {
      const relation = await this.visibility.getRelation(viewerId, row.user);
      const ok = resolveOwnVisibility(
        row.visibility as ListVisibility,
        row.user.profileAccess,
        relation,
      );
      if (!ok) return null;
    }

    return this.detail(id);
  }

  /** A user's lists visible to the viewer (their shared/public ones only). */
  async listForUser(viewerId: string, username: string): Promise<MyListDto[]> {
    const user = await this.prisma.user.findUnique({
      where: { username },
      select: { id: true, profileAccess: true },
    });
    if (!user) return [];

    const relation = await this.visibility.getRelation(viewerId, user);
    const rows = await this.prisma.list.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      include: {
        items: { orderBy: { position: "asc" }, take: PREVIEW_ITEM_COUNT },
        _count: { select: { items: true } },
      },
    });

    const visible = rows.filter((r) =>
      user.id === viewerId
        ? true
        : resolveOwnVisibility(
            r.visibility as ListVisibility,
            user.profileAccess,
            relation,
          ),
    );

    const [author, previews] = await Promise.all([
      this.author(user.id),
      this.buildPreviews(visible),
    ]);

    return visible.map((r) => ({
      ...this.toDto(r, author),
      itemCount: r._count.items,
      previewImageUrls: previews.get(r.id) ?? [],
    }));
  }

  /** Which of the user's own lists already contain this target, keyed by list id. */
  async membershipFor(
    userId: string,
    targetType: ListItemTargetType,
    targetId: string,
  ): Promise<Record<string, string>> {
    const rows = await this.prisma.listItem.findMany({
      where: { targetType, targetId, list: { userId } },
      select: { id: true, listId: true },
    });
    return Object.fromEntries(rows.map((r) => [r.listId, r.id]));
  }

  async addItem(
    userId: string,
    listId: string,
    dto: AddListItemBody,
  ): Promise<ListItemDto> {
    await this.ownList(userId, listId);

    const dup = await this.prisma.listItem.findUnique({
      where: {
        listId_targetType_targetId: {
          listId,
          targetType: dto.targetType,
          targetId: dto.targetId,
        },
      },
    });
    if (dup) throw new ConflictException("Already in this list");

    const last = await this.prisma.listItem.findFirst({
      where: { listId },
      orderBy: { position: "desc" },
      select: { position: true },
    });

    const row = await this.prisma.listItem.create({
      data: {
        listId,
        targetType: dto.targetType,
        targetId: dto.targetId,
        position: last ? last.position + 1 : 0,
      },
    });

    await this.activity.emit({
      userId,
      type: ActivityType.LIST_ITEM_ADDED,
      domain: "LISTS",
      targetType: "LIST",
      targetId: listId,
      homeFeed: false,
    });

    const targets = await this.resolveTargets([row]);
    return this.toItemDto(row, targets);
  }

  async removeItem(
    userId: string,
    listId: string,
    itemId: string,
  ): Promise<void> {
    await this.ownList(userId, listId);
    const { count } = await this.prisma.listItem.deleteMany({
      where: { id: itemId, listId },
    });
    if (count === 0) throw new NotFoundException();
  }

  /**
   * Full reorder: `orderedItemIds` must be exactly the list's current item
   * ids (in the new order) — solo-owned lists, no concurrent-edit concern, so
   * a wholesale replace is simplest and safest against a stale client.
   */
  async reorder(
    userId: string,
    listId: string,
    orderedItemIds: string[],
  ): Promise<void> {
    await this.ownList(userId, listId);

    const existing = await this.prisma.listItem.findMany({
      where: { listId },
      select: { id: true },
    });
    const existingIds = new Set(existing.map((i) => i.id));
    const sameSet =
      existingIds.size === orderedItemIds.length &&
      orderedItemIds.every((id) => existingIds.has(id));

    if (!sameSet) {
      throw new BadRequestException(
        "orderedItemIds must match the list's current items",
      );
    }

    await this.prisma.$transaction(
      orderedItemIds.map((id, position) =>
        this.prisma.listItem.update({ where: { id }, data: { position } }),
      ),
    );
  }

  // --- internals -------------------------------------------------------

  private async ownList(userId: string, id: string): Promise<ListRow> {
    const row = await this.prisma.list.findUnique({ where: { id } });
    if (!row) throw new NotFoundException();
    if (row.userId !== userId) throw new ForbiddenException();
    return row;
  }

  private async detail(id: string): Promise<ListDetailDto> {
    const row = await this.prisma.list.findUniqueOrThrow({
      where: { id },
      include: { items: { orderBy: { position: "asc" } } },
    });
    const [author, targets] = await Promise.all([
      this.author(row.userId),
      this.resolveTargets(row.items),
    ]);
    return {
      ...this.toDto(row, author),
      items: row.items.map((i) => this.toItemDto(i, targets)),
    };
  }

  private toItemDto(
    row: ListItemRow,
    targets: Map<string, ReviewTargetSummaryDto>,
  ): ListItemDto {
    return {
      id: row.id,
      targetType: row.targetType as ListItemTargetType,
      targetId: row.targetId,
      position: row.position,
      addedAt: row.addedAt.toISOString(),
      target: targets.get(`${row.targetType}:${row.targetId}`) ?? null,
    };
  }

  /**
   * Batches the collage preview (up to `PREVIEW_ITEM_COUNT` covers, in
   * position order) for a set of lists in one pass, keyed by list id.
   */
  private async buildPreviews(
    rows: { id: string; items: { targetType: string; targetId: string }[] }[],
  ): Promise<Map<string, string[]>> {
    const targets = await this.resolveTargets(rows.flatMap((r) => r.items));
    const map = new Map<string, string[]>();

    for (const r of rows) {
      const urls = r.items
        .map((i) => targets.get(`${i.targetType}:${i.targetId}`)?.imageUrl)
        .filter((u): u is string => !!u);
      map.set(r.id, urls);
    }

    return map;
  }

  /**
   * Resolves display info (title + cover + href) for a batch of list items,
   * grouped per type — same pattern as ReviewService.resolveTargets, kept as
   * a separate copy here since list items are work-level only (no
   * SEASON/EPISODE) and the two services aren't otherwise coupled.
   */
  private async resolveTargets(
    rows: { targetType: string; targetId: string }[],
  ): Promise<Map<string, ReviewTargetSummaryDto>> {
    const idsByType = new Map<string, string[]>();

    for (const r of rows) {
      const arr = idsByType.get(r.targetType) ?? [];
      arr.push(r.targetId);
      idsByType.set(r.targetType, arr);
    }

    const map = new Map<string, ReviewTargetSummaryDto>();
    const canonicalExternalIdInclude = {
      canonicalSource: true,
      externalIds: { select: { source: true, externalId: true } },
    } as const;

    const add = (
      type: string,
      items: {
        id: string;
        title: string;
        image: string | null;
        href: string | null;
      }[],
    ) => {
      for (const i of items) {
        map.set(`${type}:${i.id}`, {
          title: i.title,
          imageUrl: i.image,
          href: i.href,
        });
      }
    };

    const mediaIds = idsByType.get("MEDIA");

    if (mediaIds?.length) {
      const items = await this.prisma.mediaItem.findMany({
        where: { id: { in: mediaIds } },
        select: {
          id: true,
          title: true,
          posterUrl: true,
          type: true,
          ...canonicalExternalIdInclude,
        },
      });
      add(
        "MEDIA",
        items.map((i) => ({
          id: i.id,
          title: i.title,
          image: i.posterUrl,
          href: this.detailHref(
            "media",
            canonicalExternalId(i, i.externalIds),
            i.type.toLowerCase(),
          ),
        })),
      );
    }

    const gameIds = idsByType.get("GAME");

    if (gameIds?.length) {
      const items = await this.prisma.gameItem.findMany({
        where: { id: { in: gameIds } },
        select: {
          id: true,
          title: true,
          coverUrl: true,
          ...canonicalExternalIdInclude,
        },
      });
      add(
        "GAME",
        items.map((i) => ({
          id: i.id,
          title: i.title,
          image: i.coverUrl,
          href: this.detailHref("games", canonicalExternalId(i, i.externalIds)),
        })),
      );
    }

    const bookIds = idsByType.get("BOOK");

    if (bookIds?.length) {
      const items = await this.prisma.bookItem.findMany({
        where: { id: { in: bookIds } },
        select: {
          id: true,
          title: true,
          coverUrl: true,
          ...canonicalExternalIdInclude,
        },
      });
      add(
        "BOOK",
        items.map((i) => ({
          id: i.id,
          title: i.title,
          image: i.coverUrl,
          href: this.detailHref("books", canonicalExternalId(i, i.externalIds)),
        })),
      );
    }

    const musicIds = idsByType.get("MUSIC");

    if (musicIds?.length) {
      const items = await this.prisma.musicItem.findMany({
        where: { id: { in: musicIds } },
        select: {
          id: true,
          title: true,
          coverUrl: true,
          ...canonicalExternalIdInclude,
        },
      });
      add(
        "MUSIC",
        items.map((i) => ({
          id: i.id,
          title: i.title,
          image: i.coverUrl,
          href: this.detailHref("music", canonicalExternalId(i, i.externalIds)),
        })),
      );
    }

    return map;
  }

  private detailHref(
    domain: "media" | "games" | "books" | "music",
    sourceId: string,
    mediaType?: string,
  ): string | null {
    if (!sourceId) return null;
    return domain === "media"
      ? `/app/media/${mediaType}/${sourceId}`
      : `/${domain}/${sourceId}`;
  }
}
