import {
  ActivityType,
  ErrorCode,
  type ListDetailDto,
  type ListDto,
  type ListItemDto,
  type ListItemTargetType,
  type ListMemberDto,
  type ListViewerRole,
  type ListVisibility,
  type MyListDto,
  NotificationType,
  type ReviewTargetSummaryDto,
  type UserSummaryDto,
  XpReason,
} from "@loomkeep/shared";
import { HttpStatus, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AppException } from "../common/app.exception";
import { canonicalExternalId } from "../common/external-id.util";
import { FeatureFlagsService } from "../feature-flags/feature-flags.service";
import { XpService } from "../gamification/xp.service";
import { NotificationService } from "../notifications/notification.service";
import { PrismaService } from "../prisma/prisma.service";
import { ActivityService } from "../social/activity.service";
import { isSocialEnabled } from "../social/social.config";
import { VisibilityService } from "../social/visibility.service";
import { resolveOwnVisibility } from "../social/visibility.util";
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
    private readonly config: ConfigService,
    private readonly flags: FeatureFlagsService,
    private readonly notifications: NotificationService,
    private readonly xp: XpService,
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

    // socialGated in the barème — award() itself no-ops when SOCIAL_ENABLED
    // is off, so no flag check needed here.
    await this.xp.award(userId, XpReason.LIST_CREATED, row.id);

    return this.toDto(row, await this.author(userId));
  }

  /**
   * Updates a list's title/description/kind/items — owner or editor
   * (ListMember). Visibility changes are owner-only: an editor could
   * otherwise expose a private list. Emits LIST_SHARED on a PRIVATE→shared
   * transition.
   */
  async update(
    userId: string,
    id: string,
    dto: UpdateListBody,
  ): Promise<ListDto> {
    const { row: existing, role } = await this.canEdit(userId, id);

    if (dto.visibility && role !== "OWNER") {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        ErrorCode.ListOwnerOnlyVisibility,
      );
    }

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

    return this.toDto(row, await this.author(existing.userId));
  }

  async remove(userId: string, id: string): Promise<void> {
    const { count } = await this.prisma.list.deleteMany({
      where: { id, userId },
    });
    if (count === 0)
      throw new AppException(HttpStatus.NOT_FOUND, ErrorCode.ListNotFound);

    await this.xp.revokeBySource("List", [id]);
  }

  /**
   * Every list the user can edit — owned or granted via ListMember — newest-
   * updated first, with a preview. Feeds "Ajouter à une liste": an editor
   * needs to see the lists they can add items to, not just their own.
   */
  async listEditable(userId: string): Promise<MyListDto[]> {
    const rows = await this.prisma.list.findMany({
      where: { OR: [{ userId }, { members: { some: { userId } } }] },
      orderBy: { updatedAt: "desc" },
      include: {
        items: { orderBy: { position: "asc" }, take: PREVIEW_ITEM_COUNT },
        _count: { select: { items: true } },
      },
    });

    const authorIds = [...new Set(rows.map((r) => r.userId))];
    const authors = await Promise.all(authorIds.map((id) => this.author(id)));
    const authorById = new Map(authorIds.map((id, i) => [id, authors[i]]));
    const previews = await this.buildPreviews(rows);

    return rows.map((r) => ({
      ...this.toDto(r, authorById.get(r.userId)!),
      itemCount: r._count.items,
      previewImageUrls: previews.get(r.id) ?? [],
      role: r.userId === userId ? ("OWNER" as const) : ("EDITOR" as const),
    }));
  }

  /**
   * The list for its owner or an editor (ListMember) — for the edit screen.
   * Editors bypass `visibility` entirely: the membership grant is itself the
   * access decision, independent of the read-audience setting.
   */
  async getEditable(userId: string, id: string): Promise<ListDetailDto> {
    const { role } = await this.canEdit(userId, id);
    return this.detail(id, role);
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

    return this.detail(id, row.userId === viewerId ? "OWNER" : "VIEWER");
  }

  /**
   * A user's lists visible to the viewer — their own, plus ones they edit
   * for someone else. On the profile owner's own view (`isOwnProfile`),
   * everything shows, same as "own scope" elsewhere. Otherwise each list is
   * gated by *its actual owner's* visibility/audience, not the profile being
   * viewed — being an editor never leaks a PRIVATE/FRIENDS list of someone
   * else's to a stranger just because they're browsing the editor's profile.
   */
  async listForUser(viewerId: string, username: string): Promise<MyListDto[]> {
    const user = await this.prisma.user.findUnique({
      where: { username },
      select: { id: true, profileAccess: true },
    });
    if (!user) return [];

    const listInclude = {
      items: {
        orderBy: { position: "asc" as const },
        take: PREVIEW_ITEM_COUNT,
      },
      _count: { select: { items: true } },
    };

    const [ownRows, editorRows] = await Promise.all([
      this.prisma.list.findMany({
        where: { userId: user.id },
        orderBy: { updatedAt: "desc" },
        include: listInclude,
      }),
      this.prisma.list.findMany({
        where: { members: { some: { userId: user.id } } },
        orderBy: { updatedAt: "desc" },
        include: {
          ...listInclude,
          user: { select: { id: true, profileAccess: true } },
        },
      }),
    ]);

    const isOwnProfile = user.id === viewerId;
    let visibleOwn = ownRows;
    let visibleEditor = editorRows;

    if (!isOwnProfile) {
      const relation = await this.visibility.getRelation(viewerId, user);
      visibleOwn = ownRows.filter((r) =>
        resolveOwnVisibility(
          r.visibility as ListVisibility,
          user.profileAccess,
          relation,
        ),
      );

      const ownerRelations = new Map(
        await Promise.all(
          [...new Map(editorRows.map((r) => [r.userId, r.user])).entries()].map(
            async ([ownerId, owner]) =>
              [
                ownerId,
                await this.visibility.getRelation(viewerId, owner),
              ] as const,
          ),
        ),
      );
      visibleEditor = editorRows.filter((r) =>
        resolveOwnVisibility(
          r.visibility as ListVisibility,
          r.user.profileAccess,
          ownerRelations.get(r.userId)!,
        ),
      );
    }

    const rows = [...visibleOwn, ...visibleEditor].sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
    );

    const authorIds = [...new Set(rows.map((r) => r.userId))];
    const [authors, previews] = await Promise.all([
      Promise.all(authorIds.map((id) => this.author(id))),
      this.buildPreviews(rows),
    ]);
    const authorById = new Map(authorIds.map((id, i) => [id, authors[i]]));

    return rows.map((r) => ({
      ...this.toDto(r, authorById.get(r.userId)!),
      itemCount: r._count.items,
      previewImageUrls: previews.get(r.id) ?? [],
      role: r.userId === user.id ? ("OWNER" as const) : ("EDITOR" as const),
    }));
  }

  /** Which of the user's editable lists already contain this target, keyed by list id. */
  async membershipFor(
    userId: string,
    targetType: ListItemTargetType,
    targetId: string,
  ): Promise<Record<string, string>> {
    const rows = await this.prisma.listItem.findMany({
      where: {
        targetType,
        targetId,
        list: { OR: [{ userId }, { members: { some: { userId } } }] },
      },
      select: { id: true, listId: true },
    });
    return Object.fromEntries(rows.map((r) => [r.listId, r.id]));
  }

  async addItem(
    userId: string,
    listId: string,
    dto: AddListItemBody,
  ): Promise<ListItemDto> {
    await this.canEdit(userId, listId);

    const dup = await this.prisma.listItem.findUnique({
      where: {
        listId_targetType_targetId: {
          listId,
          targetType: dto.targetType,
          targetId: dto.targetId,
        },
      },
    });
    if (dup)
      throw new AppException(
        HttpStatus.CONFLICT,
        ErrorCode.ListItemAlreadyExists,
        undefined,
        "Already in this list",
      );

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
    await this.canEdit(userId, listId);
    const { count } = await this.prisma.listItem.deleteMany({
      where: { id: itemId, listId },
    });
    if (count === 0)
      throw new AppException(HttpStatus.NOT_FOUND, ErrorCode.ListItemNotFound);
  }

  /**
   * Full reorder: `orderedItemIds` must be exactly the list's current item
   * ids (in the new order) — a wholesale replace is simplest. Now that
   * editors can reorder concurrently, `expectedUpdatedAt` is an optimistic
   * lock on `List.updatedAt`: a stale caller gets 409 and must refetch,
   * rather than silently clobbering another editor's reorder.
   */
  async reorder(
    userId: string,
    listId: string,
    orderedItemIds: string[],
    expectedUpdatedAt: string,
  ): Promise<void> {
    await this.canEdit(userId, listId);

    const existing = await this.prisma.listItem.findMany({
      where: { listId },
      select: { id: true },
    });
    const existingIds = new Set(existing.map((i) => i.id));
    const sameSet =
      existingIds.size === orderedItemIds.length &&
      orderedItemIds.every((id) => existingIds.has(id));

    if (!sameSet) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.ListReorderMismatch,
        undefined,
        "orderedItemIds must match the list's current items",
      );
    }

    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.list.updateMany({
        where: { id: listId, updatedAt: new Date(expectedUpdatedAt) },
        data: { updatedAt: new Date() },
      });

      if (count === 0) {
        throw new AppException(
          HttpStatus.CONFLICT,
          ErrorCode.ListStale,
          undefined,
          "This list changed since you loaded it — refresh and try again",
        );
      }

      for (const [position, id] of orderedItemIds.entries()) {
        await tx.listItem.update({ where: { id }, data: { position } });
      }
    });
  }

  /** Everyone with edit access to `id`, besides the owner — owner only. */
  async listMembers(userId: string, id: string): Promise<ListMemberDto[]> {
    await this.ownList(userId, id);
    const rows = await this.prisma.listMember.findMany({
      where: { listId: id },
      orderBy: { createdAt: "asc" },
      include: { user: { select: AUTHOR_SELECT } },
    });
    return rows.map((r) => ({
      user: toUserSummaryDto(r.user),
      createdAt: r.createdAt.toISOString(),
    }));
  }

  /**
   * Grants `username` edit access to the list — owner only, social-gated.
   * Notifies the invited user in-app.
   */
  async addMember(
    userId: string,
    id: string,
    username: string,
  ): Promise<ListMemberDto> {
    const list = await this.ownList(userId, id);

    const target = await this.prisma.user.findUnique({
      where: { username },
      select: AUTHOR_SELECT,
    });
    if (!target)
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.ListMemberUserNotFound,
      );

    if (target.id === userId) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.ListCannotAddSelf,
      );
    }

    const existing = await this.prisma.listMember.findUnique({
      where: { listId_userId: { listId: id, userId: target.id } },
    });
    if (existing)
      throw new AppException(
        HttpStatus.CONFLICT,
        ErrorCode.ListMemberAlreadyEditor,
      );

    const row = await this.prisma.listMember.create({
      data: { listId: id, userId: target.id },
    });

    const owner = await this.author(userId);
    await this.notifications.create({
      userId: target.id,
      type: NotificationType.LIST_MEMBER_ADDED,
      title: owner.displayName,
      body: `vous a ajouté comme éditeur sur « ${list.title} »`,
      url: `/app/lists/${id}`,
      dedupeKey: `list-member:${id}:${target.id}`,
      data: {
        actorUsername: owner.username,
        actorDisplayName: owner.displayName,
      },
    });

    return {
      user: toUserSummaryDto(target),
      createdAt: row.createdAt.toISOString(),
    };
  }

  /**
   * Revokes edit access — the owner can remove anyone; an editor can only
   * remove themselves (leave the list). Social-gated either way, since it
   * only ever acts on a ListMember row.
   */
  async removeMember(
    userId: string,
    id: string,
    memberUserId: string,
  ): Promise<void> {
    if (userId !== memberUserId) await this.ownList(userId, id);
    const { count } = await this.prisma.listMember.deleteMany({
      where: { listId: id, userId: memberUserId },
    });
    if (count === 0)
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.ListMembershipNotFound,
      );
  }

  /**
   * Called by account deletion, right before the `User` row is removed. A
   * list with no editors just cascades away via the FK as before — but a
   * list with at least one editor now survives: ownership passes to the
   * earliest-added editor rather than silently destroying shared work the
   * group built together. (Doesn't re-clamp visibility for a GHOST new
   * owner — same as any other transfer, that only happens on an explicit
   * `update()` call.)
   */
  async reassignOwnedListsOnAccountDeletion(userId: string): Promise<void> {
    const rows = await this.prisma.list.findMany({
      where: { userId },
      select: {
        id: true,
        members: {
          orderBy: { createdAt: "asc" },
          take: 1,
          select: { userId: true },
        },
      },
    });

    for (const row of rows) {
      const newOwner = row.members[0];
      if (!newOwner) continue;

      await this.prisma.$transaction([
        this.prisma.list.update({
          where: { id: row.id },
          data: { userId: newOwner.userId },
        }),
        this.prisma.listMember.delete({
          where: {
            listId_userId: { listId: row.id, userId: newOwner.userId },
          },
        }),
      ]);
    }
  }

  // --- internals -------------------------------------------------------

  private async ownList(userId: string, id: string): Promise<ListRow> {
    const row = await this.prisma.list.findUnique({ where: { id } });
    if (!row)
      throw new AppException(HttpStatus.NOT_FOUND, ErrorCode.ListNotFound);
    if (row.userId !== userId)
      throw new AppException(HttpStatus.FORBIDDEN, ErrorCode.ListForbidden);
    return row;
  }

  /**
   * Owner or editor. Membership only grants access while Social is on —
   * ListMember rows can only be created through the social-gated add-member
   * endpoint, so this is a defensive check, not an active feature gate.
   */
  private async canEdit(
    userId: string,
    id: string,
  ): Promise<{
    row: ListRow;
    role: Extract<ListViewerRole, "OWNER" | "EDITOR">;
  }> {
    const row = await this.prisma.list.findUnique({ where: { id } });
    if (!row)
      throw new AppException(HttpStatus.NOT_FOUND, ErrorCode.ListNotFound);
    if (row.userId === userId) return { row, role: "OWNER" };

    if (isSocialEnabled(this.config, this.flags)) {
      const member = await this.prisma.listMember.findUnique({
        where: { listId_userId: { listId: id, userId } },
      });
      if (member) return { row, role: "EDITOR" };
    }

    throw new AppException(HttpStatus.FORBIDDEN, ErrorCode.ListForbidden);
  }

  private async detail(
    id: string,
    viewerRole: ListViewerRole,
  ): Promise<ListDetailDto> {
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
      viewerRole,
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
