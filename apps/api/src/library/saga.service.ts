import type { CatalogSource, MediaSagaDto, MediaType } from "@loomkeep/shared";
import { Injectable } from "@nestjs/common";
import type { ExternalSource as DbExternalSource } from "@prisma/client";
import { AnilistProvider } from "../catalog/providers/anilist.provider";
import { TmdbProvider } from "../catalog/providers/tmdb.provider";
import { PrismaService } from "../prisma/prisma.service";
import { AgeGateService } from "../users/age-gate.service";
import { LibraryService } from "./library.service";

// Same freshness as a cached MediaItem (see MediaItemService.refresh).
const SAGA_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CACHED_WORKS = 5000;

/**
 * The saga a film or an anime belongs to: its TMDB collection, or its AniList
 * main line. Walking an AniList franchise takes several throttled requests, so
 * a saga, once read, is kept a day for every one of its works.
 */
@Injectable()
export class SagaService {
  private readonly cache = new Map<
    string,
    { fetchedAt: number; saga: MediaSagaDto | null }
  >();

  constructor(
    private readonly prisma: PrismaService,
    private readonly tmdb: TmdbProvider,
    private readonly anilist: AnilistProvider,
    private readonly library: LibraryService,
    private readonly ageGate: AgeGateService,
  ) {}

  async getSaga(
    userId: string,
    type: MediaType,
    sourceId: string,
    lang?: string,
  ): Promise<MediaSagaDto | null> {
    if (type === "SERIES") return null;

    const saga = await this.catalogSaga(type, sourceId, lang);
    if (!saga) return null;

    const allowAdult = await this.ageGate.allowsAdultContent(userId);
    const members = saga.members.filter(
      (m) => allowAdult || !m.isAdult || m.sourceId === sourceId,
    );
    if (members.length < 2) return null;

    const source: CatalogSource = type === "ANIME" ? "ANILIST" : "TMDB";
    const ids = members.map((m) => m.sourceId);
    const [statuses] = await Promise.all([
      this.library.statusesBySourceId(userId, source, type, ids),
      this.rememberMembership(source, type, ids, saga.key),
    ]);

    return {
      ...saga,
      members: members.map((m) => ({
        ...m,
        status: statuses.get(m.sourceId) ?? null,
      })),
    };
  }

  private async catalogSaga(
    type: MediaType,
    sourceId: string,
    lang?: string,
  ): Promise<MediaSagaDto | null> {
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

    const entry = { fetchedAt: Date.now(), saga };

    for (const id of saga ? saga.members.map((m) => m.sourceId) : [sourceId]) {
      this.cache.delete(keyOf(id));
      this.cache.set(keyOf(id), entry);
    }

    // Maps iterate in insertion order: the first keys are the oldest.
    for (const key of this.cache.keys()) {
      if (this.cache.size <= MAX_CACHED_WORKS) break;
      this.cache.delete(key);
    }

    return saga;
  }

  /** Tags the tracked works of the saga, for library-wide uses to come. */
  private async rememberMembership(
    source: CatalogSource,
    type: MediaType,
    sourceIds: string[],
    sagaKey: string,
  ): Promise<void> {
    await this.prisma.mediaItem.updateMany({
      where: {
        externalIds: {
          some: {
            source: source as DbExternalSource,
            type,
            externalId: { in: sourceIds },
          },
        },
        OR: [{ sagaKey: null }, { sagaKey: { not: sagaKey } }],
      },
      data: { sagaKey },
    });
  }
}
