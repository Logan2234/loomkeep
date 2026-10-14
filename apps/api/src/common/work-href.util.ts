import type { PrismaService } from "../prisma/prisma.service";
import {
  CANONICAL_EXTERNAL_ID_SELECT,
  canonicalExternalId,
} from "./external-id.util";

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
  return (await resolveWorkLink(prisma, targetType, targetId))?.href ?? null;
}

/** {@link resolveWorkHref}, with the work's title for the text that links to it. */
export async function resolveWorkLink(
  prisma: PrismaService,
  targetType: string,
  targetId: string,
): Promise<{ href: string; title: string } | null> {
  const where = { id: targetId };
  const select = { title: true, ...CANONICAL_EXTERNAL_ID_SELECT };

  switch (targetType) {
    case "MEDIA": {
      const item = await prisma.mediaItem.findUnique({
        where,
        select: { ...select, type: true },
      });
      return item && link(item, `/app/media/${item.type.toLowerCase()}`);
    }

    case "GAME":
      return link(
        await prisma.gameItem.findUnique({ where, select }),
        "/app/games",
      );

    case "BOOK":
      return link(
        await prisma.bookItem.findUnique({ where, select }),
        "/app/books",
      );

    case "MUSIC":
      return link(
        await prisma.musicItem.findUnique({ where, select }),
        "/app/music",
      );

    default:
      return null;
  }
}

function link(
  item: {
    title: string;
    canonicalSource: string;
    externalIds: { source: string; externalId: string }[];
  } | null,
  base: string,
): { href: string; title: string } | null {
  if (!item) return null;
  const sourceId = canonicalExternalId(item, item.externalIds);
  return sourceId ? { href: `${base}/${sourceId}`, title: item.title } : null;
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
