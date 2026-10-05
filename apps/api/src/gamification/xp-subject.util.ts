import {
  CANONICAL_EXTERNAL_ID_SELECT,
  canonicalExternalId,
} from "../common/external-id.util";
import type { PrismaService } from "../prisma/prisma.service";
import { ACHIEVEMENTS } from "./achievements/registry";

/**
 * What an XP line is about, stored on the `XpEntry` when it is credited: by
 * the time a revoked line is read back, its source row is usually gone.
 */
export interface XpSubject {
  title: string | null;
  href: string | null;
  data: XpSubjectData;
}

export interface XpSubjectData {
  seasonNumber?: number;
  episodeNumber?: number;
  achievementKey?: string;
  domain?: string;
}

type WorkKind = "MEDIA" | "GAME" | "BOOK" | "MUSIC";

interface WorkRef {
  kind: WorkKind;
  id: string;
  data: XpSubjectData;
}

/**
 * The `XpEntry.sourceType`s that have a subject to snapshot. The others
 * ("User", "SESSION_DAY", "AdminAdjustment") have nothing to show beyond the
 * reason itself.
 */
export const SUBJECT_SOURCE_TYPES = [
  "EpisodeWatch",
  "Season",
  "LibraryEntry",
  "MovieReplay",
  "GameEntry",
  "GamePlaythrough",
  "BookEntry",
  "BookReading",
  "MusicEntry",
  "Entry",
  "Review",
  "ReviewVote",
  "Comment",
  "CommentReaction",
  "List",
  "UserAchievement",
  "DOMAIN",
];

/**
 * Resolves the subject of every `sourceIds` of one `sourceType`, in a handful
 * of queries whatever the batch size. A source that no longer exists is
 * missing from the map.
 */
export async function resolveXpSubjects(
  prisma: PrismaService,
  sourceType: string,
  sourceIds: string[],
): Promise<Map<string, XpSubject>> {
  if (sourceIds.length === 0) return new Map();

  switch (sourceType) {
    case "DOMAIN":
      return new Map(
        sourceIds.map((domain) => [
          domain,
          { title: null, href: null, data: { domain } },
        ]),
      );

    case "UserAchievement": {
      const rows = await prisma.userAchievement.findMany({
        where: { id: { in: sourceIds } },
        select: { id: true, key: true },
      });
      // A tiered achievement is named after its family, not its tier.
      return new Map(
        rows.map((row) => [
          row.id,
          {
            title: null,
            href: null,
            data: { achievementKey: ACHIEVEMENTS[row.key]?.tierOf ?? row.key },
          },
        ]),
      );
    }

    case "List": {
      const rows = await prisma.list.findMany({
        where: { id: { in: sourceIds } },
        select: { id: true, title: true },
      });
      return new Map(
        rows.map((row) => [
          row.id,
          { title: row.title, href: `/app/lists/${row.id}`, data: {} },
        ]),
      );
    }

    default:
      return describeWorks(
        prisma,
        await workRefs(prisma, sourceType, sourceIds),
      );
  }
}

async function workRefs(
  prisma: PrismaService,
  sourceType: string,
  ids: string[],
): Promise<Map<string, WorkRef>> {
  const where = { id: { in: ids } };

  switch (sourceType) {
    case "EpisodeWatch": {
      const rows = await prisma.episodeWatch.findMany({
        where,
        select: {
          id: true,
          episode: {
            select: {
              number: true,
              season: { select: { number: true, mediaItemId: true } },
            },
          },
        },
      });
      return refs(rows, (row) => ({
        kind: "MEDIA",
        id: row.episode.season.mediaItemId,
        data: {
          seasonNumber: row.episode.season.number,
          episodeNumber: row.episode.number,
        },
      }));
    }

    case "Season": {
      const rows = await prisma.season.findMany({
        where,
        select: { id: true, number: true, mediaItemId: true },
      });
      return refs(rows, (row) => ({
        kind: "MEDIA",
        id: row.mediaItemId,
        data: { seasonNumber: row.number },
      }));
    }

    case "LibraryEntry":
      return refs(
        await prisma.libraryEntry.findMany({
          where,
          select: { id: true, mediaItemId: true },
        }),
        (row) => work("MEDIA", row.mediaItemId),
      );

    case "MovieReplay":
      return refs(
        await prisma.movieReplay.findMany({
          where,
          select: { id: true, libraryEntry: { select: { mediaItemId: true } } },
        }),
        (row) => work("MEDIA", row.libraryEntry.mediaItemId),
      );

    case "GameEntry":
      return refs(
        await prisma.gameEntry.findMany({
          where,
          select: { id: true, gameItemId: true },
        }),
        (row) => work("GAME", row.gameItemId),
      );

    case "GamePlaythrough":
      return refs(
        await prisma.gamePlaythrough.findMany({
          where,
          select: { id: true, gameEntry: { select: { gameItemId: true } } },
        }),
        (row) => work("GAME", row.gameEntry.gameItemId),
      );

    case "BookEntry":
      return refs(
        await prisma.bookEntry.findMany({
          where,
          select: { id: true, bookItemId: true },
        }),
        (row) => work("BOOK", row.bookItemId),
      );

    case "BookReading":
      return refs(
        await prisma.bookReading.findMany({
          where,
          select: { id: true, bookEntry: { select: { bookItemId: true } } },
        }),
        (row) => work("BOOK", row.bookEntry.bookItemId),
      );

    case "MusicEntry":
      return refs(
        await prisma.musicEntry.findMany({
          where,
          select: { id: true, musicItemId: true },
        }),
        (row) => work("MUSIC", row.musicItemId),
      );

    // WORK_ADDED is credited for whichever entry table the work went into.
    case "Entry": {
      const found = await Promise.all(
        ["LibraryEntry", "GameEntry", "BookEntry", "MusicEntry"].map((type) =>
          workRefs(prisma, type, ids),
        ),
      );
      return new Map(found.flatMap((map) => [...map]));
    }

    case "Review":
      return targetRefs(
        prisma,
        await prisma.review.findMany({
          where,
          select: { id: true, targetType: true, targetId: true },
        }),
      );

    case "ReviewVote": {
      const rows = await prisma.reviewVote.findMany({
        where,
        select: {
          id: true,
          review: { select: { targetType: true, targetId: true } },
        },
      });
      return targetRefs(
        prisma,
        rows.map((row) => ({ id: row.id, ...row.review })),
      );
    }

    case "Comment":
      return targetRefs(
        prisma,
        await prisma.comment.findMany({
          where,
          select: { id: true, targetType: true, targetId: true },
        }),
      );

    case "CommentReaction": {
      const rows = await prisma.commentReaction.findMany({
        where,
        select: {
          id: true,
          comment: { select: { targetType: true, targetId: true } },
        },
      });
      return targetRefs(
        prisma,
        rows.map((row) => ({ id: row.id, ...row.comment })),
      );
    }

    default:
      return new Map();
  }
}

/**
 * Reviews and comments target a work, a season or an episode: the last two
 * point back to their series, with the numbers kept as data.
 */
async function targetRefs(
  prisma: PrismaService,
  rows: { id: string; targetType: string; targetId: string }[],
): Promise<Map<string, WorkRef>> {
  const targetIdsOf = (type: string) =>
    rows.filter((row) => row.targetType === type).map((row) => row.targetId);

  const [seasons, episodes] = await Promise.all([
    prisma.season.findMany({
      where: { id: { in: targetIdsOf("SEASON") } },
      select: { id: true, number: true, mediaItemId: true },
    }),
    prisma.episode.findMany({
      where: { id: { in: targetIdsOf("EPISODE") } },
      select: {
        id: true,
        number: true,
        season: { select: { number: true, mediaItemId: true } },
      },
    }),
  ]);
  const seasonById = new Map(seasons.map((s) => [s.id, s]));
  const episodeById = new Map(episodes.map((e) => [e.id, e]));

  const out = new Map<string, WorkRef>();

  for (const row of rows) {
    if (row.targetType === "SEASON") {
      const season = seasonById.get(row.targetId);

      if (season) {
        out.set(row.id, {
          kind: "MEDIA",
          id: season.mediaItemId,
          data: { seasonNumber: season.number },
        });
      }
    } else if (row.targetType === "EPISODE") {
      const episode = episodeById.get(row.targetId);

      if (episode) {
        out.set(row.id, {
          kind: "MEDIA",
          id: episode.season.mediaItemId,
          data: {
            seasonNumber: episode.season.number,
            episodeNumber: episode.number,
          },
        });
      }
    } else {
      out.set(row.id, work(row.targetType as WorkKind, row.targetId));
    }
  }

  return out;
}

async function describeWorks(
  prisma: PrismaService,
  refsBySource: Map<string, WorkRef>,
): Promise<Map<string, XpSubject>> {
  const idsOf = (kind: WorkKind) => [
    ...new Set(
      [...refsBySource.values()]
        .filter((ref) => ref.kind === kind)
        .map((ref) => ref.id),
    ),
  ];
  const select = { id: true, title: true, ...CANONICAL_EXTERNAL_ID_SELECT };

  const [media, games, books, music] = await Promise.all([
    prisma.mediaItem.findMany({
      where: { id: { in: idsOf("MEDIA") } },
      select: { ...select, type: true },
    }),
    prisma.gameItem.findMany({ where: { id: { in: idsOf("GAME") } }, select }),
    prisma.bookItem.findMany({ where: { id: { in: idsOf("BOOK") } }, select }),
    prisma.musicItem.findMany({
      where: { id: { in: idsOf("MUSIC") } },
      select,
    }),
  ]);

  const items = new Map<string, { title: string; href: string | null }>();

  const add = (
    row: {
      id: string;
      title: string;
      canonicalSource: string;
      externalIds: { source: string; externalId: string }[];
    },
    path: string,
  ) => {
    const sourceId = canonicalExternalId(row, row.externalIds);
    items.set(row.id, {
      title: row.title,
      href: sourceId ? `/app/${path}/${sourceId}` : null,
    });
  };

  for (const row of media) add(row, `media/${row.type.toLowerCase()}`);
  for (const row of games) add(row, "games");
  for (const row of books) add(row, "books");
  for (const row of music) add(row, "music");

  const out = new Map<string, XpSubject>();

  for (const [sourceId, ref] of refsBySource) {
    const item = items.get(ref.id);
    if (item) out.set(sourceId, { ...item, data: ref.data });
  }

  return out;
}

function work(kind: WorkKind, id: string): WorkRef {
  return { kind, id, data: {} };
}

function refs<T extends { id: string }>(
  rows: T[],
  toRef: (row: T) => WorkRef,
): Map<string, WorkRef> {
  return new Map(rows.map((row) => [row.id, toRef(row)]));
}
