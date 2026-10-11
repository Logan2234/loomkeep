import {
  CatalogSource,
  Domain,
  type MediaType,
  type MessageWorkKind,
  type WorkSearchResultDto,
} from "@loomkeep/shared";
import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { BookItemService } from "../books/book-item.service";
import { MediaItemService } from "../catalog/media-item.service";
import { sleep } from "../common/async.util";
import { GameItemService } from "../games/game-item.service";
import { LibraryService } from "../library/library.service";
import { MusicItemService } from "../music/music-item.service";
import { PrismaService } from "../prisma/prisma.service";
import { AgeGateService } from "../users/age-gate.service";
import { filterAdultContent } from "../users/age.util";
import { DomainGateService } from "../users/domain-gate.service";
import {
  FOLD_FROM,
  FOLD_TO,
  foldForSearch,
  parseWorkQuery,
  rankWorks,
  SEARCH_DOMAINS,
  type ParsedWorkQuery,
  type SearchDomain,
  type WorkCandidate,
} from "./work-search-ranking";

/**
 * Works returned per domain, at most: a domain whose titles match less well
 * still shows its best ones.
 */
const MAX_PER_DOMAIN = 10;
/** The instance's own works looked at per domain, at most. */
const LOCAL_PER_DOMAIN = 10;
/** A catalogue's results kept per source, at most. */
const CATALOG_PER_SOURCE = 8;
/**
 * How long a catalogue gets before the search answers without it. Its answer
 * still lands in the cache, for the next keystroke.
 */
const CATALOG_TIMEOUT_MS = 2_500;
/**
 * The same query asked again within this delay is answered from memory:
 * AniList, IGDB and MusicBrainz queue every call of the instance, so
 * repeated searches would hold everyone else up.
 */
const CATALOG_CACHE_TTL_MS = 10 * 60_000;
const CATALOG_CACHE_MAX = 500;

interface CatalogWork {
  source: string;
  sourceId: string;
  kind: MessageWorkKind;
  title: string;
  imageUrl: string | null;
  year: number | null;
  isAdult: boolean;
}

interface LocalRow {
  source: string;
  sourceId: string;
  kind: string;
  title: string;
  imageUrl: string | null;
  year: number | null;
  isAdult: boolean;
  trackers: number;
}

interface StatusRow {
  source: string;
  sourceId: string;
  kind: string;
  status: string;
}

/** Each domain's tables, for the instance's own works. */
const TABLES: Record<
  SearchDomain,
  {
    item: Prisma.Sql;
    externals: Prisma.Sql;
    entries: Prisma.Sql;
    itemKey: Prisma.Sql;
    image: Prisma.Sql;
    kind: Prisma.Sql;
    adult: Prisma.Sql;
  }
> = {
  [Domain.MEDIA]: {
    item: Prisma.raw(`"MediaItem"`),
    externals: Prisma.raw(`"MediaExternalId"`),
    entries: Prisma.raw(`"LibraryEntry"`),
    itemKey: Prisma.raw(`"mediaItemId"`),
    image: Prisma.raw(`i."posterUrl"`),
    kind: Prisma.raw(`i.type::text`),
    adult: Prisma.raw(`i."isAdult"`),
  },
  [Domain.GAMES]: {
    item: Prisma.raw(`"GameItem"`),
    externals: Prisma.raw(`"GameExternalId"`),
    entries: Prisma.raw(`"GameEntry"`),
    itemKey: Prisma.raw(`"gameItemId"`),
    image: Prisma.raw(`i."coverUrl"`),
    kind: Prisma.raw(`'GAME'`),
    adult: Prisma.raw(`i."isAdult"`),
  },
  [Domain.BOOKS]: {
    item: Prisma.raw(`"BookItem"`),
    externals: Prisma.raw(`"BookExternalId"`),
    entries: Prisma.raw(`"BookEntry"`),
    itemKey: Prisma.raw(`"bookItemId"`),
    image: Prisma.raw(`i."coverUrl"`),
    kind: Prisma.raw(`'BOOK'`),
    adult: Prisma.raw(`i."isAdult"`),
  },
  [Domain.MUSIC]: {
    item: Prisma.raw(`"MusicItem"`),
    externals: Prisma.raw(`"MusicExternalId"`),
    entries: Prisma.raw(`"MusicEntry"`),
    itemKey: Prisma.raw(`"musicItemId"`),
    image: Prisma.raw(`i."coverUrl"`),
    kind: Prisma.raw(`'MUSIC'`),
    adult: Prisma.raw(`false`),
  },
};

const SECTION: Record<Exclude<SearchDomain, "MEDIA">, string> = {
  [Domain.GAMES]: "games",
  [Domain.BOOKS]: "books",
  [Domain.MUSIC]: "music",
};

function workHref(domain: SearchDomain, kind: string, sourceId: string) {
  return domain === Domain.MEDIA
    ? `/app/media/${kind.toLowerCase()}/${sourceId}`
    : `/app/${SECTION[domain]}/${sourceId}`;
}

const refKey = (ref: { source: string; sourceId: string; kind: string }) =>
  `${ref.kind}:${ref.source}:${ref.sourceId}`;

/**
 * One search over every enabled domain. The instance's own works — every
 * work any account tracks, cached — answer at once; catalogues are asked in
 * parallel, each given {@link CATALOG_TIMEOUT_MS}, and remembered for a while.
 */
@Injectable()
export class WorkSearchService {
  private readonly catalogCache = new Map<
    string,
    { at: number; works: Promise<CatalogWork[]> }
  >();

  constructor(
    private readonly prisma: PrismaService,
    private readonly domainGate: DomainGateService,
    private readonly ageGate: AgeGateService,
    private readonly media: MediaItemService,
    private readonly games: GameItemService,
    private readonly books: BookItemService,
    private readonly music: MusicItemService,
    private readonly library: LibraryService,
  ) {}

  /** `catalogs: false`: the instance's own works only, for a first answer. */
  async search(
    userId: string,
    raw: string,
    options: { catalogs: boolean; lang?: string },
  ): Promise<WorkSearchResultDto> {
    const query = parseWorkQuery(raw);
    const [enabled, allowAdult] = await Promise.all([
      this.domainGate.getEnabledDomains(userId),
      this.ageGate.allowsAdultContent(userId),
    ]);
    const domains = SEARCH_DOMAINS.filter(
      (domain) =>
        enabled.includes(domain) && (!query.isbn || domain === Domain.BOOKS),
    );

    const [local, catalogs] = await Promise.all([
      Promise.all(
        domains.map((domain) => this.local(domain, query, allowAdult)),
      ).then((lists) => lists.flat()),
      options.catalogs
        ? Promise.all(
            domains.map((domain) =>
              this.catalog(domain, query, options.lang).then((works) => ({
                domain,
                works,
              })),
            ),
          )
        : Promise.resolve([]),
    ]);

    const byHref = new Map<string, WorkCandidate>();
    for (const candidate of local) byHref.set(candidate.hit.href, candidate);

    for (const { domain, works } of catalogs) {
      for (const [index, work] of filterAdultContent(
        works ?? [],
        allowAdult,
      ).entries()) {
        const href = workHref(domain, work.kind, work.sourceId);
        const known = byHref.get(href);

        if (known) {
          known.index = Math.min(known.index, index);
          continue;
        }

        byHref.set(href, {
          domain,
          index,
          trackers: 0,
          source: work.source,
          sourceId: work.sourceId,
          hit: {
            kind: work.kind,
            title: work.title,
            imageUrl: work.imageUrl,
            href,
            year: work.year,
            isAdult: work.isAdult,
            status: null,
          },
        });
      }
    }

    const kept = new Map<SearchDomain, number>();
    const ranked = rankWorks([...byHref.values()], raw, query).filter(
      ({ domain }) => {
        const count = (kept.get(domain) ?? 0) + 1;
        kept.set(domain, count);
        return count <= MAX_PER_DOMAIN;
      },
    );
    await this.withStatuses(userId, ranked);

    return {
      items: ranked.map((candidate) => candidate.hit),
      unavailable: catalogs
        .filter(({ works }) => works === null)
        .map(({ domain }) => domain),
    };
  }

  /** The instance's works of one domain whose title holds the query. */
  private async local(
    domain: SearchDomain,
    query: ParsedWorkQuery,
    allowAdult: boolean,
  ): Promise<WorkCandidate[]> {
    const t = TABLES[domain];
    const folded = foldForSearch(query.text);
    const pattern = `%${folded.replace(/[\\%_]/g, "\\$&")}%`;
    const title = Prisma.sql`lower(translate(i.title, ${FOLD_FROM}, ${FOLD_TO}))`;
    const matches =
      query.isbn !== null
        ? Prisma.sql`i.isbn = ${query.isbn}`
        : Prisma.sql`${title} LIKE ${pattern}`;

    const rows = await this.prisma.$queryRaw<LocalRow[]>`
      SELECT
        x.source::text AS source,
        x."externalId" AS "sourceId",
        ${t.kind} AS kind,
        i.title,
        ${t.image} AS "imageUrl",
        EXTRACT(YEAR FROM i."releaseDate")::int AS year,
        ${t.adult} AS "isAdult",
        (SELECT count(*)::int FROM ${t.entries} e WHERE e.${t.itemKey} = i.id) AS trackers
      FROM ${t.item} i
      JOIN ${t.externals} x
        ON x.${t.itemKey} = i.id AND x.source::text = i."canonicalSource"::text
      WHERE ${matches} AND (${allowAdult} OR NOT ${t.adult})
      ORDER BY (${title} = ${folded}) DESC, trackers DESC
      LIMIT ${LOCAL_PER_DOMAIN}
    `;

    return rows.map((row, index) => ({
      domain,
      index,
      trackers: row.trackers,
      source: row.source,
      sourceId: row.sourceId,
      hit: {
        kind: row.kind as MessageWorkKind,
        title: row.title,
        imageUrl: row.imageUrl,
        href: workHref(domain, row.kind, row.sourceId),
        year: row.year,
        isAdult: row.isAdult,
        status: null,
      },
    }));
  }

  /**
   * One domain's catalogue answer, or null when it failed or took longer
   * than {@link CATALOG_TIMEOUT_MS}.
   */
  private async catalog(
    domain: SearchDomain,
    query: ParsedWorkQuery,
    lang: string | undefined,
  ): Promise<CatalogWork[] | null> {
    const text = query.isbn ? `isbn:${query.isbn}` : query.text;
    const key = `${domain}|${lang ?? ""}|${foldForSearch(text)}`;
    const now = Date.now();
    let cached = this.catalogCache.get(key);

    if (!cached || now - cached.at > CATALOG_CACHE_TTL_MS) {
      const works = this.askCatalog(domain, text, lang);
      cached = { at: now, works };
      this.catalogCache.delete(key);
      this.catalogCache.set(key, cached);
      // A failed answer isn't kept: the next search asks again.
      works.catch(() => this.catalogCache.delete(key));

      if (this.catalogCache.size > CATALOG_CACHE_MAX) {
        const oldest = this.catalogCache.keys().next().value as string;
        this.catalogCache.delete(oldest);
      }
    }

    return Promise.race([
      cached.works,
      sleep(CATALOG_TIMEOUT_MS).then(() => null),
    ]).catch(() => null);
  }

  private async askCatalog(
    domain: SearchDomain,
    text: string,
    lang: string | undefined,
  ): Promise<CatalogWork[]> {
    const keep = <T>(items: T[]) => items.slice(0, CATALOG_PER_SOURCE);

    switch (domain) {
      case Domain.MEDIA: {
        // Interleaved, so each source's first result ranks alike.
        const [tmdb, anilist] = await Promise.all([
          this.media
            .providerFor(CatalogSource.TMDB)
            .search(text, undefined, 1, lang),
          this.media.providerFor(CatalogSource.ANILIST).search(text),
        ]);
        return [keep(tmdb), keep(anilist)]
          .flatMap((list) => list.map((media, index) => ({ media, index })))
          .sort((a, b) => a.index - b.index)
          .map(({ media }) => ({
            source: media.source,
            sourceId: media.sourceId,
            kind: media.type,
            title: media.title,
            imageUrl: media.posterUrl,
            year: media.year,
            isAdult: media.isAdult,
          }));
      }

      case Domain.GAMES:
        return keep(await this.games.providerFor().search(text)).map(
          (game) => ({
            source: game.source,
            sourceId: game.sourceId,
            kind: "GAME",
            title: game.title,
            imageUrl: game.coverUrl,
            year: game.year,
            isAdult: game.isAdult,
          }),
        );

      case Domain.BOOKS:
        return keep(await this.books.search(text, lang)).map((book) => ({
          source: book.source,
          sourceId: book.sourceId,
          kind: "BOOK",
          title: book.title,
          imageUrl: book.coverUrl,
          year: book.year,
          isAdult: book.isAdult,
        }));

      case Domain.MUSIC:
        return keep(await this.music.search(text)).map((album) => ({
          source: album.source,
          sourceId: album.sourceId,
          kind: "MUSIC",
          title: album.title,
          imageUrl: album.coverUrl,
          year: album.year,
          isAdult: false,
        }));
    }
  }

  /**
   * Fills in the viewer's library status of the works they track. A series'
   * status is derived from its episodes, as the library shows it: the media
   * ones come from LibraryService, not the stored column.
   */
  private async withStatuses(
    userId: string,
    refs: WorkCandidate[],
  ): Promise<void> {
    const rows = await Promise.all([
      ...SEARCH_DOMAINS.filter((domain) => domain !== Domain.MEDIA).map(
        (domain) => {
          const ids = refs
            .filter((ref) => ref.domain === domain)
            .map((ref) => ref.sourceId);
          if (ids.length === 0) return [];
          const t = TABLES[domain];

          return this.prisma.$queryRaw<StatusRow[]>`
            SELECT
              x.source::text AS source,
              x."externalId" AS "sourceId",
              ${t.kind} AS kind,
              e.status::text AS status
            FROM ${t.entries} e
            JOIN ${t.item} i ON i.id = e.${t.itemKey}
            JOIN ${t.externals} x
              ON x.${t.itemKey} = i.id AND x.source::text = i."canonicalSource"::text
            WHERE e."userId" = ${userId} AND x."externalId" = ANY(${ids})
          `;
        },
      ),
      this.mediaStatuses(
        userId,
        refs.filter((ref) => ref.domain === Domain.MEDIA),
      ),
    ]);
    const statuses = new Map(rows.flat().map((row) => [refKey(row), row]));

    for (const ref of refs) {
      ref.hit.status =
        statuses.get(refKey({ ...ref, kind: ref.hit.kind }))?.status ?? null;
    }
  }

  private async mediaStatuses(
    userId: string,
    refs: WorkCandidate[],
  ): Promise<StatusRow[]> {
    const groups = new Map<string, WorkCandidate[]>();

    for (const ref of refs) {
      const key = `${ref.source}:${ref.hit.kind}`;
      groups.set(key, [...(groups.get(key) ?? []), ref]);
    }

    const lists = await Promise.all(
      [...groups.values()].map(async (group) => {
        const { source, hit } = group[0];
        const statuses = await this.library.statusesBySourceId(
          userId,
          source as CatalogSource,
          hit.kind as MediaType,
          group.map((ref) => ref.sourceId),
        );
        return [...statuses].map(([sourceId, status]) => ({
          source,
          sourceId,
          kind: hit.kind,
          status,
        }));
      }),
    );
    return lists.flat();
  }
}
