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

    case "MUSIC": {
      const item = await prisma.musicItem.findUnique({
        where: { id: targetId },
        select: CANONICAL_INCLUDE,
      });
      if (!item) return null;
      const sourceId = canonicalExternalId(item, item.externalIds);
      return sourceId ? `/app/music/${sourceId}` : null;
    }

    default:
      return null;
  }
}

/**
 * Whether `{ targetType, targetId }` names a row that actually exists.
 *
 * `resolveWorkHref` can't answer this: it returns null both for a missing item
 * and for SEASON/EPISODE, which exist but have no browsable page. Callers that
 * write polymorphic rows (comments, reviews, reports carry no foreign key)
 * need the distinction, or a typo'd id silently creates content attached to
 * nothing.
 */
export async function workTargetExists(
  prisma: PrismaService,
  targetType: string,
  targetId: string,
): Promise<boolean> {
  const where = { id: targetId };
  const select = { id: true };

  switch (targetType) {
    case "MEDIA":
      return (await prisma.mediaItem.findUnique({ where, select })) !== null;
    case "SEASON":
      return (await prisma.season.findUnique({ where, select })) !== null;
    case "EPISODE":
      return (await prisma.episode.findUnique({ where, select })) !== null;
    case "GAME":
      return (await prisma.gameItem.findUnique({ where, select })) !== null;
    case "BOOK":
      return (await prisma.bookItem.findUnique({ where, select })) !== null;
    case "MUSIC":
      return (await prisma.musicItem.findUnique({ where, select })) !== null;
    default:
      return false;
  }
}
