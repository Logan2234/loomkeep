import { ErrorCode } from "@loomkeep/shared/catalog";
import type {
  CreatorWorkDto,
  PagedResult,
  PersonPageDto,
  StudioKind,
  StudioPageDto,
  StudioWorkOrder,
} from "@loomkeep/shared/contracts";
import { CreatorSource } from "@loomkeep/shared/contracts";
import type { BookStatus, EntryStatus } from "@loomkeep/shared/enums";
import { CatalogSource, MediaType } from "@loomkeep/shared/enums";
import { HttpStatus, Injectable } from "@nestjs/common";
import { BookSagaService } from "../books/book-saga.service";
import { OpenLibraryProvider } from "../books/providers/open-library.provider";
import { TmdbProvider } from "../catalog/providers/tmdb.provider";
import { AppException } from "../common/app.exception";
import { LibraryService } from "../library/library.service";
import { AgeGateService } from "../users/age-gate.service";

// A filmography barely moves within a day; the viewer's statuses are read
// fresh on every request, outside this cache.
const PAGE_TTL_MS = 12 * 60 * 60 * 1000;
const PAGE_CACHE_SIZE = 500;

/** Creator pages: a person's works, each with the viewer's own status. */
@Injectable()
export class CreatorService {
  // Provider pages (people, studios, catalogue pages), oldest out first.
  private readonly pages = new Map<
    string,
    { fetchedAt: number; value: unknown }
  >();

  constructor(
    private readonly tmdb: TmdbProvider,
    private readonly openLibrary: OpenLibraryProvider,
    private readonly library: LibraryService,
    private readonly bookSagas: BookSagaService,
    private readonly ageGate: AgeGateService,
  ) {}

  async getPerson(
    userId: string,
    source: CreatorSource,
    id: string,
    lang?: string,
  ): Promise<PersonPageDto> {
    if (
      source !== CreatorSource.TMDB &&
      source !== CreatorSource.OPEN_LIBRARY
    ) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.CatalogNoPersonDetails,
        { source },
        `${source} has no person page`,
      );
    }

    const page = await this.cachedPerson(source, id, lang);
    const allIds = (match: (work: CreatorWorkDto) => boolean) =>
      page.groups.flatMap((g) => g.works.filter(match).map((w) => w.sourceId));

    if (source === CreatorSource.OPEN_LIBRARY) {
      const books = await this.bookSagas.statusesBySourceId(userId, [
        ...new Set(allIds(() => true)),
      ]);
      return withStatuses(page, true, (work) => books.get(work.sourceId));
    }

    // TMDB films and series are separate id namespaces.
    const [allowAdult, movies, series] = await Promise.all([
      this.ageGate.allowsAdultContent(userId),
      this.statuses(
        userId,
        MediaType.MOVIE,
        allIds((w) => w.type === MediaType.MOVIE),
      ),
      this.statuses(
        userId,
        MediaType.SERIES,
        allIds((w) => w.type === MediaType.SERIES),
      ),
    ]);

    return withStatuses(page, allowAdult, (work) =>
      (work.type === MediaType.MOVIE ? movies : series).get(work.sourceId),
    );
  }

  private statuses(
    userId: string,
    type: MediaType,
    ids: string[],
  ): Promise<Map<string, EntryStatus>> {
    if (ids.length === 0) return Promise.resolve(new Map());
    return this.library.statusesBySourceId(userId, CatalogSource.TMDB, type, [
      ...new Set(ids),
    ]);
  }

  private cachedPerson(
    source: CreatorSource,
    id: string,
    lang?: string,
  ): Promise<PersonPageDto> {
    return this.cached(`person:${source}:${id}:${lang ?? ""}`, () =>
      source === CreatorSource.OPEN_LIBRARY
        ? this.openLibrary.getAuthorPage(id, lang)
        : this.tmdb.getPersonPage(id, lang),
    );
  }

  /** A studio's identity, its most known titles with the viewer's statuses. */
  async getStudio(
    userId: string,
    source: CreatorSource,
    kind: StudioKind,
    id: string,
    lang?: string,
  ): Promise<StudioPageDto> {
    assertStudioSource(source);
    const page = await this.cached(`studio:${kind}:${id}:${lang ?? ""}`, () =>
      this.tmdb.getStudioPage(kind, id, lang),
    );
    return {
      ...page,
      knownFor: await this.withMediaStatuses(userId, page.knownFor),
    };
  }

  /** One page of a studio's films or series, with the viewer's statuses. */
  async getStudioWorks(
    userId: string,
    source: CreatorSource,
    kind: StudioKind,
    id: string,
    query: { type: MediaType; order: StudioWorkOrder; page: number },
    lang?: string,
  ): Promise<PagedResult<CreatorWorkDto>> {
    assertStudioSource(source);
    const { type, order, page } = query;
    const result = await this.cached(
      `works:${kind}:${id}:${type}:${order}:${page}:${lang ?? ""}`,
      () => this.tmdb.getStudioWorks(kind, id, type, order, page, lang),
    );
    return {
      ...result,
      items: await this.withMediaStatuses(userId, result.items),
    };
  }

  private async withMediaStatuses(
    userId: string,
    works: CreatorWorkDto[],
  ): Promise<CreatorWorkDto[]> {
    const idsOf = (type: MediaType) =>
      works.filter((w) => w.type === type).map((w) => w.sourceId);
    const [movies, series] = await Promise.all([
      this.statuses(userId, MediaType.MOVIE, idsOf(MediaType.MOVIE)),
      this.statuses(userId, MediaType.SERIES, idsOf(MediaType.SERIES)),
    ]);
    return works.map((work) => ({
      ...work,
      status:
        (work.type === MediaType.MOVIE ? movies : series).get(work.sourceId) ??
        null,
    }));
  }

  private async cached<T>(key: string, load: () => Promise<T>): Promise<T> {
    const hit = this.pages.get(key);
    if (hit && Date.now() - hit.fetchedAt < PAGE_TTL_MS) return hit.value as T;

    const value = await load();
    this.pages.delete(key);
    this.pages.set(key, { fetchedAt: Date.now(), value });

    if (this.pages.size > PAGE_CACHE_SIZE) {
      this.pages.delete(this.pages.keys().next().value!);
    }

    return value;
  }
}

/** The cached page with the viewer's statuses, adult works left out unless allowed. */
function withStatuses(
  page: PersonPageDto,
  allowAdult: boolean,
  statusOf: (work: CreatorWorkDto) => EntryStatus | BookStatus | undefined,
): PersonPageDto {
  return {
    ...page,
    groups: page.groups
      .map((group) => ({
        ...group,
        works: group.works
          .filter((work) => allowAdult || !work.isAdult)
          .map((work) => ({ ...work, status: statusOf(work) ?? null })),
      }))
      .filter((group) => group.works.length > 0),
  };
}

/** Production companies and networks come from TMDB only. */
function assertStudioSource(source: CreatorSource): void {
  if (source !== CreatorSource.TMDB) {
    throw new AppException(
      HttpStatus.BAD_REQUEST,
      ErrorCode.CatalogNoPersonDetails,
      { source },
      `${source} has no studio page`,
    );
  }
}
