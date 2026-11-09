import type { EntryStatus, PersonPageDto } from "@loomkeep/shared";
import {
  CatalogSource,
  CreatorSource,
  ErrorCode,
  MediaType,
} from "@loomkeep/shared";
import { HttpStatus, Injectable } from "@nestjs/common";
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
    private readonly library: LibraryService,
    private readonly ageGate: AgeGateService,
  ) {}

  async getPerson(
    userId: string,
    source: CreatorSource,
    id: string,
    lang?: string,
  ): Promise<PersonPageDto> {
    if (source !== CreatorSource.TMDB) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.CatalogNoPersonDetails,
        { source },
        `${source} has no person page`,
      );
    }

    const page = await this.cachedPerson(id, lang);
    const idsOf = (type: MediaType) =>
      page.groups.flatMap((g) =>
        g.works.filter((w) => w.type === type).map((w) => w.sourceId),
      );
    // TMDB films and series are separate id namespaces.
    const [allowAdult, movies, series] = await Promise.all([
      this.ageGate.allowsAdultContent(userId),
      this.statuses(userId, MediaType.MOVIE, idsOf(MediaType.MOVIE)),
      this.statuses(userId, MediaType.SERIES, idsOf(MediaType.SERIES)),
    ]);

    return {
      ...page,
      groups: page.groups
        .map((group) => ({
          ...group,
          works: group.works
            .filter((work) => allowAdult || !work.isAdult)
            .map((work) => ({
              ...work,
              status:
                (work.type === MediaType.MOVIE ? movies : series).get(
                  work.sourceId,
                ) ?? null,
            })),
        }))
        .filter((group) => group.works.length > 0),
    };
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
    id: string,
    lang?: string,
  ): Promise<PersonPageDto> {
    const key = `${id}:${lang ?? ""}`;
    const cached = this.people.get(key);

    if (cached && Date.now() - cached.fetchedAt < PAGE_TTL_MS) {
      return cached.page;
    }

    const page = await this.tmdb.getPersonPage(id, lang);
    // Oldest entry out first (a Map iterates in insertion order).
    this.people.delete(key);
    this.people.set(key, { fetchedAt: Date.now(), page });

    if (this.people.size > PAGE_CACHE_SIZE) {
      this.people.delete(this.people.keys().next().value!);
    }

    return page;
  }
}
