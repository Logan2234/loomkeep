import type { CatalogSource, MediaSagaDto, MediaType } from "@loomkeep/shared";
import { Injectable } from "@nestjs/common";
import type { ExternalSource as DbExternalSource } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AnilistProvider } from "./providers/anilist.provider";
import { TmdbProvider } from "./providers/tmdb.provider";

// Same freshness as a cached MediaItem (see MediaItemService.refresh).
const SAGA_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CACHED_WORKS = 5000;

/**
 * Reads the saga a film or an anime belongs to — its TMDB collection, or its
 * AniList main line — and keeps the ones with a tracked work in the
 * database. Walking an AniList franchise takes several throttled requests,
 * so a saga, once read, is also kept a day in memory for every one of its
 * works: the media page and the refresh job then share a single walk.
 */
@Injectable()
export class SagaSyncService {
  private readonly cache = new Map<
    string,
    { fetchedAt: number; saga: MediaSagaDto | null }
  >();

  constructor(
    private readonly prisma: PrismaService,
    private readonly tmdb: TmdbProvider,
    private readonly anilist: AnilistProvider,
  ) {}

  /** The saga as the source shows it now, in the language asked for. */
  async read(
    type: MediaType,
    sourceId: string,
    lang?: string,
  ): Promise<MediaSagaDto | null> {
    if (type === "SERIES") return null;

    // AniList titles don't depend on the language asked for.
    const langKey = type === "ANIME" ? "" : (lang ?? "");
    const keyOf = (id: string) => `${type}:${id}:${langKey}`;

    const cached = this.cache.get(keyOf(sourceId));

    if (cached && Date.now() - cached.fetchedAt < SAGA_TTL_MS) {
      return cached.saga;
    }

    const saga =
      type === "ANIME"
        ? await this.anilist.getSaga(sourceId)
        : await this.tmdb.getSaga(sourceId, lang);

    this.remember(
      saga ? saga.members.map((m) => m.sourceId) : [sourceId],
      keyOf,
      saga,
    );
    return saga;
  }

  /**
   * A saved TMDB saga in another language, for the library's sagas view: one
   * collection request per saga and language a day, shared with the media
   * pages through the same cache.
   */
  async readCollection(
    sagaKey: string,
    memberIds: string[],
    lang: string,
  ): Promise<MediaSagaDto | null> {
    const keyOf = (id: string) => `MOVIE:${id}:${lang}`;
    const cached = memberIds
      .map((id) => this.cache.get(keyOf(id)))
      .find((e) => e && Date.now() - e.fetchedAt < SAGA_TTL_MS);
    if (cached) return cached.saga;

    const saga = await this.tmdb.getCollection(
      sagaKey.replace(/^TMDB:/, ""),
      lang,
    );
    this.remember(
      saga ? saga.members.map((m) => m.sourceId) : memberIds,
      keyOf,
      saga,
    );
    return saga;
  }

  private remember(
    ids: string[],
    keyOf: (id: string) => string,
    saga: MediaSagaDto | null,
  ): void {
    const entry = { fetchedAt: Date.now(), saga };

    for (const id of ids) {
      this.cache.delete(keyOf(id));
      this.cache.set(keyOf(id), entry);
    }

    // Maps iterate in insertion order: the first keys are the oldest.
    for (const key of this.cache.keys()) {
      if (this.cache.size <= MAX_CACHED_WORKS) break;
      this.cache.delete(key);
    }
  }

  /**
   * Reads a tracked work's saga in the source's base language and saves it.
   * A work that joins a saga already saved is stamped `announcedAt`: the
   * sequel alert's cue.
   */
  async sync(type: MediaType, sourceId: string): Promise<void> {
    const saga = await this.read(type, sourceId);
    if (saga) await this.save(type, saga);
  }

  /** Tags the tracked works of the saga with its key. */
  async rememberMembership(
    type: MediaType,
    sourceIds: string[],
    sagaKey: string,
  ): Promise<number> {
    const { count } = await this.prisma.mediaItem.updateMany({
      where: {
        externalIds: {
          some: {
            source: sourceOf(type),
            type,
            externalId: { in: sourceIds },
          },
        },
        OR: [{ sagaKey: null }, { sagaKey: { not: sagaKey } }],
      },
      data: { sagaKey },
    });
    return count;
  }

  private async save(type: MediaType, saga: MediaSagaDto): Promise<void> {
    const ids = saga.members.map((m) => m.sourceId);
    const tracked = await this.prisma.mediaItem.count({
      where: {
        externalIds: {
          some: { source: sourceOf(type), type, externalId: { in: ids } },
        },
      },
    });
    if (tracked === 0) return;

    const known = await this.prisma.sagaMember.findMany({
      where: { sagaKey: saga.key },
      select: { sourceId: true },
    });
    const knownIds = new Set(known.map((m) => m.sourceId));
    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.saga.upsert({
        where: { key: saga.key },
        create: { key: saga.key, title: saga.title, syncedAt: now },
        update: { title: saga.title, syncedAt: now },
      }),
      ...saga.members.map((member, position) => {
        const fields = {
          source: sourceOf(type),
          type,
          position,
          title: member.title,
          posterUrl: member.posterUrl,
          releaseDate: member.releaseDate,
          format: member.format,
          episodes: member.episodes,
          isAdult: member.isAdult,
          upcoming: member.upcoming,
        };
        return this.prisma.sagaMember.upsert({
          where: {
            sagaKey_sourceId: { sagaKey: saga.key, sourceId: member.sourceId },
          },
          update: fields,
          create: {
            ...fields,
            sagaKey: saga.key,
            sourceId: member.sourceId,
            announcedAt:
              knownIds.size > 0 && !knownIds.has(member.sourceId) ? now : null,
          },
        });
      }),
      this.prisma.sagaMember.deleteMany({
        where: { sagaKey: saga.key, sourceId: { notIn: ids } },
      }),
    ]);

    await this.rememberMembership(type, ids, saga.key);
  }
}

function sourceOf(type: MediaType): DbExternalSource {
  const source: CatalogSource = type === "ANIME" ? "ANILIST" : "TMDB";
  return source as DbExternalSource;
}
