import type {
  CatalogSource,
  EntryStatus,
  LibrarySagaDto,
  LibrarySagaSort,
  LibrarySagasDto,
  MediaSagaDto,
  MediaType,
  SagaMemberDto,
} from "@loomkeep/shared";
import { Injectable, Logger } from "@nestjs/common";
import type { SagaMember } from "@prisma/client";
import { SagaSyncService } from "../catalog/saga-sync.service";
import { mapWithConcurrency } from "../common/concurrency.util";
import { PrismaService } from "../prisma/prisma.service";
import { AgeGateService } from "../users/age-gate.service";
import { LibraryService } from "./library.service";
import { sagaProgress } from "./saga-progress.util";

export interface LibrarySagaFilters {
  types?: MediaType[];
  q?: string;
  sort?: LibrarySagaSort;
  order?: "asc" | "desc";
  lang?: string;
}

/**
 * Sagas as the viewer sees them: the one on a work's page, and the ones in
 * progress across their library.
 */
@Injectable()
export class SagaService {
  private readonly logger = new Logger(SagaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sagas: SagaSyncService,
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
    const entries = await this.prisma.libraryEntry.findMany({
      where: {
        userId,
        mediaItem: {
          sagaKey: { not: null },
          type: filters.types?.length ? { in: filters.types } : undefined,
        },
      },
      select: { updatedAt: true, mediaItem: { select: { sagaKey: true } } },
    });
    const lastActivity = new Map<string, Date>();

    for (const { updatedAt, mediaItem } of entries) {
      const key = mediaItem.sagaKey!;
      const last = lastActivity.get(key);
      if (!last || updatedAt > last) lastActivity.set(key, updatedAt);
    }

    const q = filters.q?.trim().toLowerCase();
    const sagas = await this.prisma.saga.findMany({
      where: { key: { in: [...lastActivity.keys()] } },
      include: { members: { orderBy: { position: "asc" } } },
    });
    const allowAdult = await this.ageGate.allowsAdultContent(userId);
    const [statuses, translated] = await Promise.all([
      this.statusesOf(
        userId,
        sagas.flatMap((saga) => saga.members),
      ),
      this.translations(sagas, filters.lang),
    ]);

    const result: LibrarySagasDto = { inProgress: [], waiting: [] };

    for (const saga of sagas) {
      const translation = translated.get(saga.key);
      const titles = new Map(
        translation?.members.map((m) => [m.sourceId, m.title]),
      );
      const title = translation?.title ?? saga.title;
      const members = saga.members
        .filter((m) => allowAdult || !m.isAdult)
        .map((m) => ({
          ...toMemberDto(m, statuses.get(`${m.type}:${m.sourceId}`)),
          title: titles.get(m.sourceId) ?? m.title,
        }));

      if (
        q &&
        !title.toLowerCase().includes(q) &&
        !members.some((m) => m.title.toLowerCase().includes(q))
      ) {
        continue;
      }

      const progress = sagaProgress(members);
      if (progress.state === "none") continue;
      result[progress.state].push({
        key: saga.key,
        title,
        members,
        next: progress.next,
        seen: progress.seen,
        released: progress.released,
        lastActivityAt: lastActivity.get(saga.key)!.toISOString(),
      });
    }

    const compare = sagaComparator(filters.sort ?? "recent");
    const direction = filters.order === "asc" ? -1 : 1;

    for (const list of [result.inProgress, result.waiting]) {
      list.sort((a, b) => compare(a, b) * direction);
    }

    return result;
  }

  /**
   * Film sagas are saved in TMDB's base language; anime titles don't change
   * with it. A translation is one collection request per saga and language a
   * day, cached and shared — and a failed one just keeps the saved titles.
   */
  private async translations(
    sagas: { key: string; members: SagaMember[] }[],
    lang: string | undefined,
  ): Promise<Map<string, MediaSagaDto>> {
    const films = sagas.filter((saga) => saga.key.startsWith("TMDB:"));
    if (!lang || lang === "en" || films.length === 0) return new Map();

    const read = await mapWithConcurrency(films, 4, (saga) =>
      this.sagas
        .readCollection(
          saga.key,
          saga.members.map((m) => m.sourceId),
          lang,
        )
        .catch(() => null),
    );
    return new Map(
      films.flatMap((saga, i) => {
        const translation = read[i];
        return translation ? [[saga.key, translation] as const] : [];
      }),
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

/** Descending by default: most recent, Z to A, furthest along first. */
function sagaComparator(
  sort: LibrarySagaSort,
): (a: LibrarySagaDto, b: LibrarySagaDto) => number {
  switch (sort) {
    case "title":
      return (a, b) => b.title.localeCompare(a.title);
    case "progress":
      return (a, b) => b.seen / b.released - a.seen / a.released;
    default:
      return (a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt);
  }
}
