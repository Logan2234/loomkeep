import type {
  CommentTargetType,
  MessageWorkKind,
  WorkThreadDto,
} from "@loomkeep/shared";
import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  CANONICAL_EXTERNAL_ID_SELECT,
  canonicalExternalId,
} from "../common/external-id.util";
import { PrismaService } from "../prisma/prisma.service";

/** Discussions the "Œuvres" tab lists, at most. */
const WORK_THREADS_MAX = 50;

type ThreadRow = {
  targetType: CommentTargetType;
  targetId: string;
  mineAt: Date;
  lastAt: Date | null;
  unread: bigint;
};

type Described = Pick<
  WorkThreadDto,
  "title" | "kind" | "seasonNumber" | "episodeNumber" | "imageUrl" | "href"
> & { libraryKey: string | null };

const key = (type: string, id: string) => `${type}:${id}`;

/**
 * Works' discussions as Messages shows them: the ones a member wrote in or
 * was mentioned in, latest of their own activity first, with what's unread
 * since they last read — or, before that, since their own last word. The
 * comments stay in their own table and API: only their reading is tracked
 * here.
 */
@Injectable()
export class WorkThreadService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<WorkThreadDto[]> {
    const rows = await this.threads(userId);
    return this.toDtos(userId, rows);
  }

  /** One discussion, followed or not yet: opening it from a work's page. */
  async get(
    userId: string,
    targetType: CommentTargetType,
    targetId: string,
  ): Promise<WorkThreadDto | null> {
    const followed = (await this.threads(userId)).find(
      (row) => row.targetType === targetType && row.targetId === targetId,
    );
    const [dto] = await this.toDtos(userId, [
      followed ?? {
        targetType,
        targetId,
        mineAt: new Date(0),
        lastAt: null,
        unread: 0n,
      },
    ]);
    return dto ?? null;
  }

  async unreadTotal(userId: string): Promise<number> {
    const rows = await this.threads(userId);
    return rows.reduce((sum, row) => sum + Number(row.unread), 0);
  }

  async markRead(
    userId: string,
    targetType: CommentTargetType,
    targetId: string,
  ): Promise<void> {
    const lastReadAt = new Date();
    await this.prisma.commentThreadRead.upsert({
      where: { userId_targetType_targetId: { userId, targetType, targetId } },
      update: { lastReadAt },
      create: { userId, targetType, targetId, lastReadAt },
    });
  }

  // A mention counts from just before it, so the comment holding it is
  // unread; a discussion the member wrote in, from their last word.
  private threads(userId: string): Promise<ThreadRow[]> {
    return this.prisma.$queryRaw<ThreadRow[]>`
      WITH mine AS (
        SELECT c."targetType", c."targetId", MAX(c."createdAt") AS at
        FROM "Comment" c
        WHERE c."authorId" = ${userId} AND c."deletedAt" IS NULL
        GROUP BY c."targetType", c."targetId"
        UNION ALL
        SELECT c."targetType", c."targetId",
          MAX(m."createdAt") - INTERVAL '1 millisecond' AS at
        FROM "CommentMention" m
        JOIN "Comment" c ON c.id = m."commentId"
        WHERE m."userId" = ${userId} AND c."deletedAt" IS NULL
        GROUP BY c."targetType", c."targetId"
      ), threads AS (
        SELECT "targetType", "targetId", MAX(at) AS "mineAt"
        FROM mine
        GROUP BY "targetType", "targetId"
      )
      SELECT t."targetType", t."targetId", t."mineAt",
        (
          SELECT MAX(c."createdAt") FROM "Comment" c
          WHERE c."targetType" = t."targetType"
            AND c."targetId" = t."targetId"
            AND c."deletedAt" IS NULL
        ) AS "lastAt",
        (
          SELECT COUNT(*) FROM "Comment" c
          WHERE c."targetType" = t."targetType"
            AND c."targetId" = t."targetId"
            AND c."deletedAt" IS NULL
            AND c."authorId" IS DISTINCT FROM ${userId}
            AND c."createdAt" > COALESCE(r."lastReadAt", t."mineAt")
            AND NOT EXISTS (
              SELECT 1 FROM "Block" b
              WHERE (b."blockerId" = ${userId} AND b."blockedId" = c."authorId")
                 OR (b."blockerId" = c."authorId" AND b."blockedId" = ${userId})
            )
        ) AS unread
      FROM threads t
      LEFT JOIN "CommentThreadRead" r
        ON r."userId" = ${userId}
        AND r."targetType" = t."targetType"
        AND r."targetId" = t."targetId"
      ORDER BY t."mineAt" DESC
      LIMIT ${WORK_THREADS_MAX}
    `;
  }

  private async toDtos(
    userId: string,
    rows: ThreadRow[],
  ): Promise<WorkThreadDto[]> {
    if (rows.length === 0) return [];
    const [described, lastComments] = await Promise.all([
      this.describe(rows),
      this.lastComments(rows),
    ]);
    const tracked = await this.tracked(userId, [...described.values()]);

    return rows.flatMap((row) => {
      const target = described.get(key(row.targetType, row.targetId));
      if (!target) return [];
      const last = lastComments.get(key(row.targetType, row.targetId));
      const { libraryKey, ...work } = target;

      return [
        {
          targetType: row.targetType,
          targetId: row.targetId,
          ...work,
          unread: Number(row.unread),
          canParticipate: !!libraryKey && tracked.has(libraryKey),
          lastActivityAt: (row.lastAt ?? row.mineAt).toISOString(),
          lastComment: last
            ? {
                authorName: last.displayName,
                mine: last.authorId === userId,
                text: last.spoilerTag ? null : last.text,
              }
            : null,
        },
      ];
    });
  }

  private async lastComments(rows: ThreadRow[]) {
    const latest = await this.prisma.$queryRaw<
      {
        targetType: string;
        targetId: string;
        text: string | null;
        spoilerTag: boolean;
        authorId: string | null;
        displayName: string | null;
      }[]
    >`
      SELECT DISTINCT ON (c."targetType", c."targetId")
        c."targetType", c."targetId", c.text, c."spoilerTag", c."authorId",
        u."displayName"
      FROM "Comment" c
      LEFT JOIN "User" u ON u.id = c."authorId"
      WHERE c."deletedAt" IS NULL
        AND (c."targetType", c."targetId") IN (${Prisma.join(
          rows.map(
            (row) =>
              Prisma.sql`(${row.targetType}::"CommentTargetType", ${row.targetId})`,
          ),
        )})
      ORDER BY c."targetType", c."targetId", c."createdAt" DESC
    `;
    return new Map(latest.map((c) => [key(c.targetType, c.targetId), c]));
  }

  /** Title, poster and page of each target, batched per kind. */
  private async describe(rows: ThreadRow[]): Promise<Map<string, Described>> {
    const idsOf = (type: CommentTargetType) =>
      rows.filter((r) => r.targetType === type).map((r) => r.targetId);
    const out = new Map<string, Described>();
    const mediaSelect = {
      id: true,
      title: true,
      posterUrl: true,
      type: true,
      ...CANONICAL_EXTERNAL_ID_SELECT,
    } as const;

    const mediaHref = (item: {
      type: string;
      canonicalSource: string;
      externalIds: { source: string; externalId: string }[];
    }) => {
      const sourceId = canonicalExternalId(item, item.externalIds);
      return sourceId
        ? `/app/media/${item.type.toLowerCase()}/${sourceId}`
        : null;
    };

    const [media, seasons, episodes, games, books, music] = await Promise.all([
      this.prisma.mediaItem.findMany({
        where: { id: { in: idsOf("MEDIA") } },
        select: mediaSelect,
      }),
      this.prisma.season.findMany({
        where: { id: { in: idsOf("SEASON") } },
        select: { id: true, number: true, mediaItem: { select: mediaSelect } },
      }),
      this.prisma.episode.findMany({
        where: { id: { in: idsOf("EPISODE") } },
        select: {
          id: true,
          number: true,
          season: {
            select: { number: true, mediaItem: { select: mediaSelect } },
          },
        },
      }),
      this.prisma.gameItem.findMany({
        where: { id: { in: idsOf("GAME") } },
        select: {
          id: true,
          title: true,
          coverUrl: true,
          ...CANONICAL_EXTERNAL_ID_SELECT,
        },
      }),
      this.prisma.bookItem.findMany({
        where: { id: { in: idsOf("BOOK") } },
        select: {
          id: true,
          title: true,
          coverUrl: true,
          ...CANONICAL_EXTERNAL_ID_SELECT,
        },
      }),
      this.prisma.musicItem.findMany({
        where: { id: { in: idsOf("MUSIC") } },
        select: {
          id: true,
          title: true,
          coverUrl: true,
          ...CANONICAL_EXTERNAL_ID_SELECT,
        },
      }),
    ]);

    for (const item of media) {
      out.set(key("MEDIA", item.id), {
        title: item.title,
        kind: item.type as MessageWorkKind,
        seasonNumber: null,
        episodeNumber: null,
        imageUrl: item.posterUrl,
        href: mediaHref(item),
        libraryKey: key("MEDIA", item.id),
      });
    }

    for (const season of seasons) {
      const item = season.mediaItem;
      out.set(key("SEASON", season.id), {
        title: item.title,
        kind: item.type as MessageWorkKind,
        seasonNumber: season.number,
        episodeNumber: null,
        imageUrl: item.posterUrl,
        href: mediaHref(item),
        libraryKey: key("MEDIA", item.id),
      });
    }

    for (const episode of episodes) {
      const item = episode.season.mediaItem;
      const page = mediaHref(item);
      out.set(key("EPISODE", episode.id), {
        title: item.title,
        kind: item.type as MessageWorkKind,
        seasonNumber: episode.season.number,
        episodeNumber: episode.number,
        imageUrl: item.posterUrl,
        href: page
          ? `${page}#s${episode.season.number}e${episode.number}`
          : null,
        libraryKey: key("MEDIA", item.id),
      });
    }

    const domain = (
      type: "GAME" | "BOOK" | "MUSIC",
      section: string,
      items: {
        id: string;
        title: string;
        coverUrl: string | null;
        canonicalSource: string;
        externalIds: { source: string; externalId: string }[];
      }[],
    ) => {
      for (const item of items) {
        const sourceId = canonicalExternalId(item, item.externalIds);
        out.set(key(type, item.id), {
          title: item.title,
          kind: type,
          seasonNumber: null,
          episodeNumber: null,
          imageUrl: item.coverUrl,
          href: sourceId ? `/app/${section}/${sourceId}` : null,
          libraryKey: key(type, item.id),
        });
      }
    };

    domain("GAME", "games", games);
    domain("BOOK", "books", books);
    domain("MUSIC", "music", music);

    return out;
  }

  /** Library entries the member holds among these works. */
  private async tracked(
    userId: string,
    works: Described[],
  ): Promise<Set<string>> {
    const idsOf = (type: string) =>
      works.flatMap((w) =>
        w.libraryKey?.startsWith(`${type}:`)
          ? [w.libraryKey.slice(type.length + 1)]
          : [],
      );
    const [media, games, books, music] = await Promise.all([
      this.prisma.libraryEntry.findMany({
        where: { userId, mediaItemId: { in: idsOf("MEDIA") } },
        select: { mediaItemId: true },
      }),
      this.prisma.gameEntry.findMany({
        where: { userId, gameItemId: { in: idsOf("GAME") } },
        select: { gameItemId: true },
      }),
      this.prisma.bookEntry.findMany({
        where: { userId, bookItemId: { in: idsOf("BOOK") } },
        select: { bookItemId: true },
      }),
      this.prisma.musicEntry.findMany({
        where: { userId, musicItemId: { in: idsOf("MUSIC") } },
        select: { musicItemId: true },
      }),
    ]);
    return new Set([
      ...media.map((e) => key("MEDIA", e.mediaItemId)),
      ...games.map((e) => key("GAME", e.gameItemId)),
      ...books.map((e) => key("BOOK", e.bookItemId)),
      ...music.map((e) => key("MUSIC", e.musicItemId)),
    ]);
  }
}
