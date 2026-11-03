import type { ShowcaseDto } from "@loomkeep/shared";
import { Injectable, Logger } from "@nestjs/common";
import { TmdbProvider } from "../catalog/providers/tmdb.provider";
import { IgdbProvider } from "../games/providers/igdb.provider";
import { PrismaService } from "../prisma/prisma.service";

const TTL_MS = 24 * 60 * 60 * 1000;
/**
 * Books and albums come from the instance itself, where a cover says what its
 * users follow: only one followed this widely, so no single account shows.
 */
export const SHOWCASE_MIN_FOLLOWERS = 10;
const PER_SOURCE = 12;

/**
 * The covers behind the sign-in page, which is open to anyone: this week's
 * trending films, series and games, plus the instance's most followed books
 * and albums. One computation a day, whoever asks.
 */
@Injectable()
export class ShowcaseService {
  private readonly logger = new Logger(ShowcaseService.name);
  private cached: { at: number; result: Promise<ShowcaseDto> } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tmdb: TmdbProvider,
    private readonly igdb: IgdbProvider,
  ) {}

  get(): Promise<ShowcaseDto> {
    if (!this.cached || Date.now() - this.cached.at > TTL_MS) {
      this.cached = { at: Date.now(), result: this.collect() };
    }

    return this.cached.result;
  }

  private async collect(): Promise<ShowcaseDto> {
    const sources = await Promise.allSettled([
      this.tmdb.trendingPosters(),
      this.igdb.popularCovers(),
      this.followedBooks(),
      this.followedAlbums(),
    ]);

    const posters = sources.flatMap((source, i) => {
      if (source.status === "fulfilled") {
        return source.value.slice(0, i === 0 ? PER_SOURCE * 2 : PER_SOURCE);
      }

      // A catalog not configured on this instance just leaves its share out.
      this.logger.warn(
        `Showcase source ${i} skipped: ${String(source.reason)}`,
      );
      return [];
    });
    return { posters: [...new Set(posters)] };
  }

  private async followedBooks(): Promise<string[]> {
    const groups = await this.prisma.bookEntry.groupBy({
      by: ["bookItemId"],
      _count: { _all: true },
      having: { bookItemId: { _count: { gte: SHOWCASE_MIN_FOLLOWERS } } },
      orderBy: { _count: { bookItemId: "desc" } },
      take: PER_SOURCE,
    });
    const books = await this.prisma.bookItem.findMany({
      where: {
        id: { in: groups.map((g) => g.bookItemId) },
        isAdult: false,
        coverUrl: { not: null },
      },
      select: { coverUrl: true },
    });
    return books.flatMap((b) => (b.coverUrl ? [b.coverUrl] : []));
  }

  private async followedAlbums(): Promise<string[]> {
    const groups = await this.prisma.musicEntry.groupBy({
      by: ["musicItemId"],
      _count: { _all: true },
      having: { musicItemId: { _count: { gte: SHOWCASE_MIN_FOLLOWERS } } },
      orderBy: { _count: { musicItemId: "desc" } },
      take: PER_SOURCE,
    });
    const albums = await this.prisma.musicItem.findMany({
      where: {
        id: { in: groups.map((g) => g.musicItemId) },
        coverUrl: { not: null },
      },
      select: { coverUrl: true },
    });
    return albums.flatMap((a) => (a.coverUrl ? [a.coverUrl] : []));
  }
}
