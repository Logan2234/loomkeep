import type { PrismaService } from "../prisma/prisma.service";
import { canonicalExternalId } from "./external-id.util";

const CANONICAL_INCLUDE = {
  canonicalSource: true,
  externalIds: { select: { source: true, externalId: true } },
} as const;

/**
 * Client route to a work's detail page from a ReviewTargetType/
 * CommentTargetType-shaped `{ targetType, targetId }` pair. Null for
 * SEASON/EPISODE (no browsable page yet) or when the item can't be found.
 * Shared between review/comment/report resolution — same lookup, three
 * call sites.
 */
export async function resolveWorkHref(
  prisma: PrismaService,
  targetType: string,
  targetId: string,
): Promise<string | null> {
  switch (targetType) {
    case "MEDIA": {
      const item = await prisma.mediaItem.findUnique({
        where: { id: targetId },
        select: { type: true, ...CANONICAL_INCLUDE },
      });
      if (!item) return null;
      const sourceId = canonicalExternalId(item, item.externalIds);
      return sourceId
        ? `/app/media/${item.type.toLowerCase()}/${sourceId}`
        : null;
    }

    case "GAME": {
      const item = await prisma.gameItem.findUnique({
        where: { id: targetId },
        select: CANONICAL_INCLUDE,
      });
      if (!item) return null;
      const sourceId = canonicalExternalId(item, item.externalIds);
      return sourceId ? `/app/games/${sourceId}` : null;
    }

    case "BOOK": {
      const item = await prisma.bookItem.findUnique({
        where: { id: targetId },
        select: CANONICAL_INCLUDE,
      });
      if (!item) return null;
      const sourceId = canonicalExternalId(item, item.externalIds);
      return sourceId ? `/app/books/${sourceId}` : null;
    }

    default:
      return null;
  }
}
