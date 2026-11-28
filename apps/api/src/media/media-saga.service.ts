import type {
  LibrarySagaSort,
  LibrarySagasDto,
  MediaSagaDto,
  SagaMemberDto,
} from "@loomkeep/shared/contracts";
import { type SortOrder } from "@loomkeep/shared/contracts";
import type {
  CatalogSource,
  EntryStatus,
  MediaType,
} from "@loomkeep/shared/enums";
import { Injectable, Logger } from "@nestjs/common";
import type { SagaMember } from "@prisma/client";
import { forEachIsolated } from "../jobs/for-each-isolated";
import { PrismaService } from "../prisma/prisma.service";
import { AgeGateService } from "../users/age-gate.service";
import { MediaProgressService } from "./media-progress.service";
import {
  MEDIA_SAGA_STATUS,
  sagaComparator,
  sagaProgress,
} from "./saga-progress.util";
import { SagaSyncService } from "./saga-sync.service";

type SagaTitles = { title: string; members: Record<string, string> };

export interface LibrarySagaFilters {
  types?: MediaType[];
  q?: string;
  sort?: LibrarySagaSort;
  order?: SortOrder;
  lang?: string;
}

/**
 * Sagas as the viewer sees them: the one on a work's page, and the ones in
 * progress across their library.
 */
/** TMDB collections asked at once while translating sagas. */
const TRANSLATION_CONCURRENCY = 4;

@Injectable()
export class MediaSagaService {
  private readonly logger = new Logger(MediaSagaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sagas: SagaSyncService,
    private readonly library: MediaProgressService,
    private readonly ageGate: AgeGateService,
  ) {}

  async getSaga(
    userId: string,
    type: MediaType,
    sourceId: string,
    lang?: string,
  ): Promise<MediaSagaDto | null> {
    if (type === "SERIES") return null;

    const saga = await this.sagas.read(type, sourceId, lang);
    if (!saga) return null;

    const allowAdult = await this.ageGate.allowsAdultContent(userId);
    const members = saga.members.filter(
      (m) => allowAdult || !m.isAdult || m.sourceId === sourceId,
    );
    if (members.length < 2) return null;

    const source: CatalogSource = type === "ANIME" ? "ANILIST" : "TMDB";
    const ids = members.map((m) => m.sourceId);
    const [statuses, tagged] = await Promise.all([
      this.library.statusesBySourceId(userId, source, type, ids),
      this.sagas.rememberMembership(type, ids, saga.key),
    ]);

    // A work just tracked joins the saga now rather than at the next refresh,
    // so the library's sagas view shows it straight away.
    if (tagged > 0) {
      this.sagas
        .sync(type, sourceId)
        .catch((err) => this.logger.warn(`Saga sync failed: ${saga.key}`, err));
    }

    return {
      ...saga,
      members: members.map((m) => ({
        ...m,
        status: statuses.get(m.sourceId) ?? null,
      })),
    };
  }

  /**
   * The sagas of the viewer's library, from what the refresh job saved: the
   * ones in progress and the ones waiting on an announced sequel.
   */
  async listSagas(
    userId: string,
    filters: LibrarySagaFilters = {},
  ): Promise<LibrarySagasDto> {
    const entries = await this.prisma.mediaEntry.findMany({
      where: {
        userId,
        mediaItem: {
          sagaKey: { not: null },
          type: filters.types?.length ? { in: filters.types } : undefined,
        },
      },
      select: {
        updatedAt: true,
        finishedAt: true,
        mediaItem: { select: { sagaKey: true } },
      },
    });
    const lastActivity = new Map<string, Date>();
    const lastFinished = new Map<string, Date>();

    for (const { updatedAt, finishedAt, mediaItem } of entries) {
      const key = mediaItem.sagaKey!;
      const last = lastActivity.get(key);
      if (!last || updatedAt > last) lastActivity.set(key, updatedAt);
      const finished = lastFinished.get(key);

      if (finishedAt && (!finished || finishedAt > finished)) {
        lastFinished.set(key, finishedAt);
      }
    }

    const q = filters.q?.trim().toLowerCase();
    const sagas = await this.viewerSagas(
      userId,
      await this.prisma.saga.findMany({
        where: { key: { in: [...lastActivity.keys()] } },
        include: { members: { orderBy: { position: "asc" } } },
      }),
      filters.lang,
    );

    const result: LibrarySagasDto = {
      inProgress: [],
      waiting: [],
      finished: [],
    };

    for (const { key, title, members } of sagas) {
      if (
        q &&
        !title.toLowerCase().includes(q) &&
        !members.some((m) => m.title.toLowerCase().includes(q))
      ) {
        continue;
      }

      const progress = sagaProgress(members, MEDIA_SAGA_STATUS);
      if (progress.state === "none") continue;
      result[progress.state].push({
        key,
        title,
        members,
        next: progress.next,
        seen: progress.seen,
        released: progress.released,
        lastActivityAt: lastActivity.get(key)!.toISOString(),
        finishedAt: lastFinished.get(key)?.toISOString() ?? null,
      });
    }

    const compare = sagaComparator(filters.sort ?? "recent");
    const direction = filters.order === "asc" ? -1 : 1;

    for (const list of [result.inProgress, result.waiting, result.finished]) {
      list.sort((a, b) => compare(a, b) * direction);
    }

    return result;
  }

  /**
   * A saga as saved, the way the viewer sees it: what a /saga card shows,
   * without asking TMDB or AniList again.
   */
  async savedSaga(
    userId: string,
    key: string,
    lang?: string,
  ): Promise<MediaSagaDto | null> {
    const saga = await this.prisma.saga.findUnique({
      where: { key },
      include: { members: { orderBy: { position: "asc" } } },
    });
    if (!saga) return null;
    const [viewed] = await this.viewerSagas(userId, [saga], lang);
    return viewed;
  }

  /** Saved sagas in the viewer's language, with their status on each work. */
  private async viewerSagas(
    userId: string,
    sagas: { key: string; title: string; members: SagaMember[] }[],
    lang: string | undefined,
  ): Promise<MediaSagaDto[]> {
    const [allowAdult, statuses, translated] = await Promise.all([
      this.ageGate.allowsAdultContent(userId),
      this.statusesOf(
        userId,
        sagas.flatMap((saga) => saga.members),
      ),
      this.translations(sagas, lang),
    ]);

    return sagas.map((saga) => {
      const translation = translated.get(saga.key);
      return {
        key: saga.key,
        title: translation?.title ?? saga.title,
        members: saga.members
          .filter((m) => allowAdult || !m.isAdult)
          .map((m) => ({
            ...toMemberDto(m, statuses.get(`${m.type}:${m.sourceId}`)),
            title: translation?.members[m.sourceId] ?? m.title,
          })),
      };
    });
  }

  /**
   * Film sagas are saved in TMDB's base language; anime titles don't change
   * with it. A saga is translated once per language and kept, then asked
   * again only when a work joined it. The asking happens in the background:
   * this answer carries the saved titles, the next one the translation.
   */
  private async translations(
    sagas: { key: string; title: string; members: SagaMember[] }[],
    lang: string | undefined,
  ): Promise<Map<string, SagaTitles>> {
    const films = sagas.filter((saga) => saga.key.startsWith("TMDB:"));
    if (!lang || lang === "en" || films.length === 0) return new Map();

    const stored = await this.prisma.sagaTranslation.findMany({
      where: { locale: lang, sagaKey: { in: films.map((saga) => saga.key) } },
    });
    const translated = new Map<string, SagaTitles>(
      stored.map((row) => [
        row.sagaKey,
        {
          title: row.title,
          members: row.memberTitles as Record<string, string>,
        },
      ]),
    );
    const missing = films.filter((saga) => {
      const titles = translated.get(saga.key)?.members;
      return !titles || saga.members.some((m) => !(m.sourceId in titles));
    });

    if (missing.length > 0) void this.translateInBackground(missing, lang);
    return translated;
  }

  /**
   * Saves each saga's titles in `lang`. A saga TMDB has no collection for,
   * or a work it no longer lists, keeps its saved title, so it isn't asked
   * again on every call. A failed request saves nothing: the next call tries
   * again.
   */
  private async translateInBackground(
    sagas: { key: string; title: string; members: SagaMember[] }[],
    lang: string,
  ): Promise<void> {
    await forEachIsolated(
      sagas,
      async (saga) => {
        const collection = await this.sagas.readCollection(
          saga.key,
          saga.members.map((m) => m.sourceId),
          lang,
        );
        const read = new Map(
          (collection?.members ?? []).map((m) => [m.sourceId, m.title]),
        );
        const titles: SagaTitles = {
          title: collection?.title ?? saga.title,
          members: Object.fromEntries(
            saga.members.map((m) => [
              m.sourceId,
              read.get(m.sourceId) ?? m.title,
            ]),
          ),
        };
        // Two requests can translate the same saga at once: one save is enough.
        await this.prisma.sagaTranslation.upsert({
          where: { sagaKey_locale: { sagaKey: saga.key, locale: lang } },
          create: {
            sagaKey: saga.key,
            locale: lang,
            title: titles.title,
            memberTitles: titles.members,
          },
          update: { title: titles.title, memberTitles: titles.members },
        });
      },
      {
        logger: this.logger,
        label: (saga) => `Saga translation of ${saga.key} in ${lang}`,
        concurrency: TRANSLATION_CONCURRENCY,
      },
    );
  }

  private async statusesOf(
    userId: string,
    members: SagaMember[],
  ): Promise<Map<string, EntryStatus>> {
    const statuses = new Map<string, EntryStatus>();

    for (const type of ["MOVIE", "ANIME"] as const) {
      const ids = members.filter((m) => m.type === type).map((m) => m.sourceId);
      if (ids.length === 0) continue;
      const source: CatalogSource = type === "ANIME" ? "ANILIST" : "TMDB";
      const byId = await this.library.statusesBySourceId(
        userId,
        source,
        type,
        ids,
      );
      for (const [id, status] of byId) statuses.set(`${type}:${id}`, status);
    }

    return statuses;
  }
}

function toMemberDto(
  m: SagaMember,
  status: EntryStatus | undefined,
): SagaMemberDto {
  return {
    source: m.source as CatalogSource,
    sourceId: m.sourceId,
    type: m.type as MediaType,
    title: m.title,
    year: m.releaseDate ? Number(m.releaseDate.slice(0, 4)) : null,
    posterUrl: m.posterUrl,
    isAdult: m.isAdult,
    releaseDate: m.releaseDate,
    format: m.format,
    episodes: m.episodes,
    upcoming: m.upcoming,
    status: status ?? null,
  };
}
