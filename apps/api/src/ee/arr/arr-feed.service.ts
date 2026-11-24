import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CalendarFeedService } from "../calendar/calendar-feed.service";
import type { ArrFeedItem } from "./arr-feed.util";

const ITEM_SELECT = {
  title: true,
  type: true,
  externalIds: { select: { source: true, externalId: true } },
} as const;

/**
 * What Radarr and Sonarr import (INT-09): the titles of a member's pile, or
 * of one of their own lists. Behind the calendar's token, so one "Regenerate"
 * revokes every subscription link at once, and premium like it.
 */
@Injectable()
export class ArrFeedService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calendarFeed: CalendarFeedService,
  ) {}

  /** The pile's "to watch" titles, oldest first; null for a bad token. */
  async pile(token: string): Promise<ArrFeedItem[] | null> {
    const user = await this.calendarFeed.premiumUserForToken(token);
    if (!user) return null;

    const entries = await this.prisma.mediaEntry.findMany({
      where: { userId: user.id, status: "PLANNED" },
      orderBy: { createdAt: "asc" },
      select: { mediaItem: { select: ITEM_SELECT } },
    });
    return entries.map((e) => e.mediaItem);
  }

  /**
   * The films and series of a list the token's owner created, in the list's
   * order; null for a bad token or someone else's list, which reads the same.
   */
  async list(token: string, listId: string): Promise<ArrFeedItem[] | null> {
    const user = await this.calendarFeed.premiumUserForToken(token);
    if (!user) return null;

    const list = await this.prisma.list.findFirst({
      where: { id: listId, userId: user.id },
      select: {
        items: {
          where: { targetType: "MEDIA" },
          orderBy: { position: "asc" },
          select: { targetId: true },
        },
      },
    });
    if (!list) return null;

    const ids = list.items.map((i) => i.targetId);
    const items = await this.prisma.mediaItem.findMany({
      where: { id: { in: ids } },
      select: { id: true, ...ITEM_SELECT },
    });
    const byId = new Map(items.map((item) => [item.id, item]));
    return ids.flatMap((id) => {
      const item = byId.get(id);
      return item ? [item] : [];
    });
  }
}
