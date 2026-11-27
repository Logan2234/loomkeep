import { ErrorCode } from "@loomkeep/shared/catalog";
import type { ArrTokenDto } from "@loomkeep/shared/contracts";
import { HttpStatus, Injectable } from "@nestjs/common";
import { AppException } from "../../common/app.exception";
import { randomToken } from "../../common/crypto.util";
import { EntitlementService } from "../../entitlements/entitlement.service";
import { PrismaService } from "../../prisma/prisma.service";
import { saveUserUrlToken } from "../../users/user-url-token.writer";
import type { ArrFeedItem } from "./arr-feed.util";

const ITEM_SELECT = {
  title: true,
  type: true,
  externalIds: { select: { source: true, externalId: true } },
} as const;

/**
 * What Radarr and Sonarr import (INT-09): the titles of a member's pile, or
 * of one of their own lists. One token covers both tools and every list, so
 * one "Regenerate" revokes all of their links at once.
 */
@Injectable()
export class ArrFeedService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementService,
  ) {}

  /** The pile's "to watch" titles, oldest first; null for a bad token. */
  async pile(token: string): Promise<ArrFeedItem[] | null> {
    const user = await this.premiumUserForToken(token);
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
    const user = await this.premiumUserForToken(token);
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

  /**
   * The token, generated on first call and stable afterwards —
   * `regenerateToken` revokes every link handed to Radarr or Sonarr.
   */
  async getToken(userId: string): Promise<ArrTokenDto> {
    await this.requirePremium(userId);

    const row = await this.prisma.userUrlToken.findUnique({
      where: { userId },
      select: { arrToken: true },
    });

    if (row?.arrToken) {
      return { token: row.arrToken };
    }

    return this.issueToken(userId);
  }

  async regenerateToken(userId: string): Promise<ArrTokenDto> {
    await this.requirePremium(userId);
    return this.issueToken(userId);
  }

  /**
   * The premium check is repeated on every fetch, so a downgraded account's
   * Radarr and Sonarr stop getting fed the moment its plan changes.
   */
  private async premiumUserForToken(
    token: string,
  ): Promise<{ id: string } | null> {
    const row = await this.prisma.userUrlToken.findUnique({
      where: { arrToken: token },
      select: { userId: true },
    });

    if (!row || !(await this.entitlements.isEffectivelyPremium(row.userId))) {
      return null;
    }

    return { id: row.userId };
  }

  private async issueToken(userId: string): Promise<ArrTokenDto> {
    const token = randomToken(24, "base64url");
    await saveUserUrlToken(this.prisma, userId, "arrToken", token);
    return { token };
  }

  private async requirePremium(userId: string): Promise<void> {
    if (!(await this.entitlements.isEffectivelyPremium(userId))) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        ErrorCode.UserPremiumRequired,
        undefined,
        "This feature is reserved for premium accounts",
      );
    }
  }
}
