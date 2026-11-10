import type {
  BookStatus,
  CreatorWorkDto,
  EntryStatus,
  PersonPageDto,
} from "@loomkeep/shared";
import {
  CatalogSource,
  CreatorSource,
  ErrorCode,
  MediaType,
} from "@loomkeep/shared";
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
  private readonly people = new Map<
    string,
    { fetchedAt: number; page: PersonPageDto }
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

  private async cachedPerson(
    source: CreatorSource,
    id: string,
    lang?: string,
  ): Promise<PersonPageDto> {
    const key = `${source}:${id}:${lang ?? ""}`;
    const cached = this.people.get(key);

    if (cached && Date.now() - cached.fetchedAt < PAGE_TTL_MS) {
      return cached.page;
    }

    const page =
      source === CreatorSource.OPEN_LIBRARY
        ? await this.openLibrary.getAuthorPage(id, lang)
        : await this.tmdb.getPersonPage(id, lang);
    // Oldest entry out first (a Map iterates in insertion order).
    this.people.delete(key);
    this.people.set(key, { fetchedAt: Date.now(), page });

    if (this.people.size > PAGE_CACHE_SIZE) {
      this.people.delete(this.people.keys().next().value!);
    }

    return page;
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
